package amber.corwin.youtube;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebMessage;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.CharBuffer;
import java.util.Map;
import java.util.TreeMap;

import amber.corwin.youtube.server.HTTPD;



public class MainActivity extends Activity {

    private static final String TAG = "Android.Tube";

    private WebView webView;
    public Player player;   // expose to HTTPD

    private HTTPD httpd;

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
        player.setUriHandler(new Player.UriHandler() {
            @Override
            public void resolveTrack(final Playlist.Track track, final Callback callback) {
                requestStream(track.uri, new OnReceivedUrl() {
                    @Override
                    public void receivedUrl(String watchUrl, String type, String mediaUrl) {
                        callback.resolved(Uri.parse(mediaUrl));
                    }
                });
            }
        });

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

    public InputStream openAsset(String path) {
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

    // ---------------
    // JS Interop Part
    // ---------------

    class JsInterface {
        @JavascriptInterface
        public void receivedUrl(String watchUrl, String type, String mediaUrl) {
            Log.i(TAG, mediaUrl + "  (" + type + ")");

            OnReceivedUrl cont = pendingCalls.get(watchUrl);
            if (cont != null) {
                cont.receivedUrl(watchUrl, type, mediaUrl);     // initiated by requestStream
                pendingCalls.remove(watchUrl);
            }
            else
                player.playMedia(Uri.parse(mediaUrl));          // initiated by JS
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

    public void jsCall(String json) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.postWebMessage(new WebMessage(json), Uri.EMPTY);
        }
        else {
            webView.evaluateJavascript("onmessage({data: '" + quote(json) + "'})",
                    null);
        }
    }

    void requestStream(Uri youtubeUrl, OnReceivedUrl callback) {
        requestStream(youtubeUrl.toString(), callback);
    }

    void requestStream(final String youtubeUrl, OnReceivedUrl callback) {
        if (callback != null)
            pendingCalls.put(youtubeUrl, callback);

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                jsCall("{\"type\": \"watch\", \"url\": \"" + youtubeUrl + "\"}");
            }
        });
    }

    interface OnReceivedUrl {
        void receivedUrl(String watchUrl, String type, String mediaUrl);
    }
    private Map<String, OnReceivedUrl> pendingCalls = new TreeMap<>();

    private String quote(String s) {
        return s.replace("\\", "\\\\").replace("'", "\\'");
    }

    // -----------------
    // AudioManager Part
    // -----------------

    AudioManager audioManager = null;

    void setVolume(int level, int max) {
        int volMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level * volMax / max, 0);
    }

    public void setVolume(VolumeSetting vol) {
        setVolume(vol.level, vol.max);
    }

    public VolumeSetting getVolume() {
        return new VolumeSetting(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC),
                                 audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
    }

    // -----------
    // Server Part
    // -----------


    void startServer() {
        httpd = new HTTPD(this);
        try {
            httpd.start();
        }
            catch (IOException e) {
            Log.e(TAG, "startServer", e);
        }
    }
}
