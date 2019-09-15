package amber.corwin.youtube;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.icu.util.Output;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.util.SparseArray;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebMessage;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.VideoView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.Reader;
import java.nio.CharBuffer;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

public class MainActivity extends Activity {

    private static final String TAG = "Android.Tube";

    private WebView webView;
    private Player player;

    private Server httpd;

    private PowerManager.WakeLock wakeLock;

    private static final String HTML =
            "<html><head>" +
                    "<script src=\"./js/lib/jquery.min.js\"></script>" +
                    "<script src=\"./js/lib/lodash.min.js\"></script>" +
                    "<script src=\"./js/lib/vue.min.js\"></script>" +
                    "<script src=\"./js/lib/ytdl.browser.js\"></script>" +
                    "<script src=\"./js/main.js\"></script>" +
                    "<script src=\"./js/yapi.js\"></script>" +
                    "<script src=\"./js/components/search.js\"></script>" +
                    "<script src=\"./js/components/volume.js\"></script>" +
                    "<link rel=\"stylesheet\" type=\"text/css\" href=\"./css/yt.css\">" +
                    "</head><body><div id=\"ui-container\"></div>"+
            "</body></html>";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);

        player = new Player(this);
        //player.attach((VideoView) findViewById(R.id.video));

        webView = findViewById(R.id.webview);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webView.addJavascriptInterface(new JsInterface(), "mainActivity");

        Log.i(TAG, "-- start --");

        final String initialMessage =
                "{\"type\": \"search\", \"text\": \"lara fabian\"}";

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(final WebView view, WebResourceRequest req) {
                Log.i(TAG, "URL: " + req.getUrl());
                String scheme = req.getUrl().getScheme();
                String path = req.getUrl().getPath();
                if (scheme != null && scheme.equals("file") && path != null) {
                    return new WebResourceResponse("text/javascript", "UTF-8",
                            openAsset(path));
                } else {
                    return super.shouldInterceptRequest(view, req);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    view.postWebMessage(new WebMessage(initialMessage), Uri.EMPTY);
                }
            }
        });

        webView.loadDataWithBaseURL("file:///main.html",
                readAsString(openAsset("/html/app.html")),
                "text/html",
                "utf-8", null);

        startServer();

        // CPU Wake lock  :/
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                TAG + " ::CPUWakeLock");
        wakeLock.acquire();
    }

    @Override
    protected void onDestroy() {
        wakeLock.release();
        super.onDestroy();
    }

    InputStream openAsset(String path) {
        if (path.startsWith("/")) path = path.substring(1);
        try {
            return getAssets().open(path);
        }
        catch (IOException e) {
            Log.e(TAG, "missing asset, " + path);
            return new ByteArrayInputStream(new byte[0]); // empty :/
        }
    }

    String readAsString(InputStream in) { return readAsString(in, 4096); }

    String readAsString(InputStream in, int capacity) {
        Reader r = new InputStreamReader(in);
        CharBuffer b = CharBuffer.allocate(capacity);
        try {
            while (r.read(b) > 0) ;
            int size = b.position(); b.rewind();
            return b.subSequence(0, size).toString();
        }
        catch (IOException e) {
            Log.e(TAG, "error reading from stream", e);
            return "";
        }
    }

    class JsInterface {
        @JavascriptInterface
        public void receivedUrl(String watchUrl, String type, final String mediaUrl) {
            Log.i(TAG, type);
            Log.i(TAG, mediaUrl);

            player.playMedia(Uri.parse(mediaUrl));
        }
        @JavascriptInterface
        public void setVolume(int level, int max) {
            player.setVolume(level, max);
        }
        @JavascriptInterface
        public void postResponse(int id, String resp) throws IOException {
            httpd.postResponse(id, resp);
        }
    }

    // -----------------
    // AudioManager Part
    // -----------------

    AudioManager audioManager = null;

    void setVolume(int level, int max) {
        int volMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level * volMax / max, 0);
    }

    void setVolume(VolumeSetting vol) {
        setVolume(vol.level, vol.max);
    }

    VolumeSetting getVolume() {
        return new VolumeSetting(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC),
                                 audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    }

    // -----------
    // Server Part
    // -----------

    class Server extends NanoHTTPD {

        private int nextReqId = 3;
        SparseArray<OutputStream> pendingRequests = new SparseArray<>();

        Server() { super(2224); }

        @Override
        public Response serve(IHTTPSession session) {
            Method method = session.getMethod();
            String path = session.getUri();

            if (path.equals("/") && method == Method.GET)
                return index();
            else if (path.equals("/js/yapi.js"))
                return asset("/js/client.js");
            else if (path.startsWith("/js/") || path.startsWith("/css/"))
                return asset(path);
            else if (path.startsWith("/vol"))
                return vol(session);
            else if (path.startsWith("/pos"))
                return pos(session);
            else if (path.equals("/pause"))
                return pause();
            else if (path.equals("/resume"))
                return resume();
            else if (method == Method.POST)
                return handlePost(session);
            else
                return super.serve(session);
        }

        private Response index() {
            return newChunkedResponse(Response.Status.OK, "text/html",
                    openAsset("/html/app.html"));
        }

        private Response asset(String path) {
            return newChunkedResponse(Response.Status.OK, "text/javascript",
                    openAsset(path));
        }

        private Response pause() { player.pause(); return ok(); }

        private Response resume() { player.resume(); return ok(); }

        private Response vol(IHTTPSession session) {
            Method method = session.getMethod();
            String q = session.getQueryParameterString();
            try {
                if (method == Method.GET)
                    return newFixedLengthResponse("" + player.getVolume() + ";" + getVolume());
                else {
                    if (q != null) {
                        String[] volumes = q.split(";");
                        if (volumes.length >= 1 && volumes[0].length() > 0) {
                            player.setVolume(VolumeSetting.parse(volumes[0]));
                        }
                        if (volumes.length >= 2 && volumes[1].length() > 0) {
                            setVolume(VolumeSetting.parse(volumes[1]));
                        }
                    }
                    return ok();
                }
            } catch (NumberFormatException e) {
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain","bad request 'vol?" + q + "'");
            }
        }

        private Response pos(IHTTPSession session) {
            Method method = session.getMethod();
            String q = session.getQueryParameterString();
            try {
                if (method == Method.GET)
                    return newFixedLengthResponse("" + player.getPosition());
                else {
                    if (q != null)
                        player.setPosition(Integer.parseInt(q));
                    return ok();
                }
            } catch (NumberFormatException e) {
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain","bad request 'vol?" + q + "'");
            }
        }

        private Response ok() {
            return newFixedLengthResponse(Response.Status.OK, "text/plain", "ok");
        }

        Response handlePost(IHTTPSession session) {
            Map<String, String> files = new HashMap<String, String>();
            try {
                session.parseBody(files);
            }
            catch (IOException e) { Log.e(TAG, "serve: read error", e); }
            catch (ResponseException e) { Log.e(TAG, "serve: bad response", e); }

            String postData = files.get("postData");

            if (postData == null) {
                return super.serve(session);
            }

            int id = nextReqId++;

            final String msg = "{\"type\": \"request\", \"id\": " + id + ", \"inner\": " + postData + "}";

            PipedInputStream data = new PipedInputStream();
            PipedOutputStream pipe = new PipedOutputStream();
            try {
                pipe.connect(data);
                synchronized (this) {
                    pendingRequests.put(id, pipe);
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            webView.postWebMessage(new WebMessage(msg), Uri.EMPTY);
                        }
                        else {
                            webView.evaluateJavascript("onmessage({data: '" + quote(msg) + "'})",
                                    null);
                        }
                    }
                });
                return newChunkedResponse(Response.Status.OK, "text/json", data);
            }
            catch (IOException e) {
                Log.e(TAG, "Server.serve", e);
                return super.serve(session);
            }
        }

        void postResponse(int id, String resp) {
            OutputStream pipe;
            synchronized (this) {
                pipe = this.pendingRequests.get(id);
            }
            if (pipe != null) {
                try {
                    pipe.write(resp.getBytes());
                    pipe.close();
                }
                catch (IOException e) {
                    Log.w(TAG, "response is lost", e);
                }
                finally {
                    this.pendingRequests.remove(id);
                }
            }
        }

        private String quote(String s) {
            return s.replace("\\", "\\\\").replace("'", "\\'");
        }
    }

    void startServer() {
        httpd = new Server();
        try {
            httpd.start();
        }
            catch (IOException e) {
            Log.e(TAG, "startServer", e);
        }
    }
}
