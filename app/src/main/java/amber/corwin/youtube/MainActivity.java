package amber.corwin.youtube;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.icu.util.Output;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
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
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

public class MainActivity extends Activity {

    private static final String TAG = "Android.Tube";

    private WebView webView;
    private Player player;

    private Server httpd;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);

        player = new Player(this);
        player.attach((VideoView) findViewById(R.id.video));

        webView = findViewById(R.id.webview);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webView.addJavascriptInterface(new JsInterface(), "mainActivity");

        Log.i(TAG, "-- start --");

        //final String initialMessage =
        //        "{\"type\": \"watch\", \"url\": \"https://www.youtube.com/watch?v=ntj-sP8y3kw\"}";
        final String initialMessage =
                "{\"type\": \"search\", \"text\": \"lara fabian\"}";

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(final WebView view, WebResourceRequest req) {
                Log.i(TAG, "URL: " + req.getUrl());
                String scheme = req.getUrl().getScheme();
                if (scheme != null && scheme.equals("file")) {
                    return new WebResourceResponse("text/javascript", "UTF-8",
                            openAsset(req.getUrl().getPath()));
                } else {
                    return super.shouldInterceptRequest(view, req);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.postWebMessage(new WebMessage(initialMessage), Uri.EMPTY);
            }
        });

        webView.loadDataWithBaseURL("file:///main.html",
                "<html><head>" +
                        "<script src=\"./js/lib/jquery.min.js\"></script>" +
                        "<script src=\"./js/lib/lodash.min.js\"></script>" +
                        "<script src=\"./js/lib/vue.min.js\"></script>" +
                        "<script src=\"./js/lib/ytdl.browser.js\"></script>" +
                        "<script src=\"./js/main.js\"></script>" +
                        "<script src=\"./js/components/search.js\"></script>" +
                        "<script src=\"./js/components/volume.js\"></script>" +
                        "<link rel=\"stylesheet\" type=\"text/css\" href=\"./css/yt.css\">" +
                        "</head><body><div id=\"ui-container\"></div></body></html>",
                "text/html",
                "utf-8", null);

        startServer();
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
        public void postResponse(String resp) throws IOException {
            OutputStream pipe = httpd.clientResponseStream;
            httpd.clientResponseStream = null;

            pipe.write(resp.getBytes());
            pipe.close();
        }
    }

    // -----------------
    // AudioManager Part
    // -----------------

    static class VolumeSetting {
        public int level;
        public int max;
        VolumeSetting(int level, int max) { this.level = level; this.max = max; }

        @Override @NonNull
        public String toString() {
            return "" + level + "/" + max;
        }
    }

    AudioManager audioManager = null;

    void setVolume(int level, int max) {
        int volMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level * volMax / max, 0);
    }

    VolumeSetting getVolume() {
        return new VolumeSetting(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC),
                                 audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    }

    // -----------
    // Server Part
    // -----------

    class Server extends NanoHTTPD {

        OutputStream clientResponseStream = null;

        Server() { super(2224); }

        @Override
        public Response serve(IHTTPSession session) {
            Method method = session.getMethod();
            String path = session.getUri();

            if (path.startsWith("/vol"))
                return vol(session);
            if (method == Method.POST)
                return handlePost(session);
            else
                return super.serve(session);
        }

        private Response vol(IHTTPSession session) {
            String q = session.getQueryParameterString();
            try {
                if (q == null || q.equals(""))
                    return newFixedLengthResponse("" + getVolume());
                else {
                    String[] parts = q.split("/");
                    if (parts.length == 2) {
                        int level = Integer.parseInt(parts[0]);
                        int max = Integer.parseInt(parts[1]);
                        if (max > 0 && level <= max)
                            setVolume(level, max);
                        else throw new NumberFormatException();
                    }
                    else throw new NumberFormatException();
                    return newFixedLengthResponse("ok");
                }
            } catch (NumberFormatException e) {
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain","bad request 'vol?" + q + "'");
            }
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

            final String msg = "{\"type\": \"request\", \"inner\": " + postData + "}";

            PipedInputStream data = new PipedInputStream();
            PipedOutputStream pipe = new PipedOutputStream();
            try {
                pipe.connect(data);
                if (clientResponseStream != null) clientResponseStream.close();
                clientResponseStream = pipe;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        webView.postWebMessage(new WebMessage(msg), Uri.EMPTY);
                    }
                });
                return newChunkedResponse(Response.Status.OK, "text/json", data);
            }
            catch (IOException e) {
                Log.e(TAG, "Server.serve", e);
                return super.serve(session);
            }
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
