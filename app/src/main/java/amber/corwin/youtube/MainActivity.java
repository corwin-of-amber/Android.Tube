package amber.corwin.youtube;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
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

public class MainActivity extends Activity {

    private static final String TAG = "Android.YouTube";

    private WebView webView;
    private Player player;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);


        player = new Player(this);
        player.attach((VideoView)findViewById(R.id.video));

        webView = findViewById(R.id.webview);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webView.addJavascriptInterface(new JsInterface(), "mainActivity");

        Log.i(TAG, "-- start --");

        //final String initialMessage =
        //        "{\"type\": \"watch\", \"url\": \"https://www.youtube.com/watch?v=ntj-sP8y3kw\"}";
        final String initialMessage =
                "{\"type\": \"search\", \"text\": \"einaudi seven\"}";

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest (final WebView view, WebResourceRequest req) {
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
                        "<script src=\"./js/lib/jquery.js\"></script>" +
                        "<script src=\"./js/lib/lodash.min.js\"></script>" +
                        "<script src=\"./js/lib/vue.min.js\"></script>" +
                        "<script src=\"./js/lib/ytdl.browser.js\"></script>" +
                        "<script src=\"./js/main.js\"></script>" +
                        "<script src=\"./js/components/search.js\"></script>" +
                        "<link rel=\"stylesheet\" type=\"text/css\" href=\"./css/yt.css\">" +
                        "</head><body><div id=\"search-ui\"></div></body></html>",
                "text/html",
                "utf-8", null);
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
            /*
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mediaPlayer = new MediaPlayer();
                        mediaPlayer.setDataSource(MainActivity.this, Uri.parse(mediaUrl));

                    }
                    catch (IOException e) { }
                    //webView.loadUrl(mediaUrl);
                }
            });*/

        }
    }
}
