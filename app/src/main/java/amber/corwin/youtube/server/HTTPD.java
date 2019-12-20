package amber.corwin.youtube.server;


import android.content.Context;
import android.net.Uri;
import android.os.AsyncTask;
import android.util.Log;
import android.util.SparseArray;

import org.json.JSONException;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import amber.corwin.youtube.MainActivity;
import amber.corwin.youtube.Player;
import amber.corwin.youtube.Playlist;
import amber.corwin.youtube.VolumeSetting;
import fi.iki.elonen.NanoWSD;



public class HTTPD extends NanoWSD {

    private static final String TAG = "HTTPD";

    private MainActivity context;

    private int nextReqId = 3;
    private SparseArray<OutputStream> pendingRequests = new SparseArray<>();

    private FetchTask fetchTask = null;

    public HTTPD(MainActivity context) { super(2224); this.context = context; }

    @Override
    public Response serve(IHTTPSession session) {
        Method method = session.getMethod();
        String path = session.getUri();

        if (isWebsocketRequested(session)) return super.serve(session);

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
        else if (path.startsWith("/fetch"))
            return fetch(session);
        else if (path.startsWith("/cache"))
            return cache(session);
        else if (method == Method.POST)
            return handlePost(session);
        else
            return super.serve(session);
    }

    private Response index() {
        return newChunkedResponse(Response.Status.OK, "text/html",
                context.openAsset("/html/app.html"));
    }

    private Response asset(String path) {
        return newChunkedResponse(Response.Status.OK, "text/javascript",
                context.openAsset(path));
    }

    private Response pause() { context.player.pause(); return ok(); }

    private Response resume() { context.player.resume(); return ok(); }

    private Response vol(IHTTPSession session) {
        Method method = session.getMethod();
        String q = session.getQueryParameterString();
        try {
            if (method == Method.GET)
                return newFixedLengthResponse("" + context.player.getVolume() + ";" + context.getVolume());
            else {
                if (q != null) {
                    String[] volumes = q.split(";");
                    if (volumes.length >= 1 && volumes[0].length() > 0) {
                        context.player.setVolume(VolumeSetting.parse(volumes[0]));
                    }
                    if (volumes.length >= 2 && volumes[1].length() > 0) {
                        context.setVolume(VolumeSetting.parse(volumes[1]));
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
                return newFixedLengthResponse("" + context.player.getPosition());
            else {
                if (q != null)
                    context.player.setPosition(Integer.parseInt(q));
                return ok();
            }
        } catch (NumberFormatException e) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain","bad request 'vol?" + q + "'");
        }
    }

    private Response fetch(IHTTPSession session) {
        String q = session.getQueryParameterString();
        try {
            fetchTask = new FetchTask(cacheDir(), context.player);
            fetchTask.execute(new URL(q));
            return ok();
        }
        catch (MalformedURLException e) {
            return error("fetch " + q + ": " + e);
        }
    }

    private Response cache(IHTTPSession session) {
        String path = session.getUri();
        try {
            File file = new File(cacheDir(), basename(path));

            InputStream data = new FileInputStream(file);
            return newFixedLengthResponse(Response.Status.OK,
                    "application/octet-stream", data, file.length());
        }
        catch (IOException e) {
            return error("cache: " + e);
        }
    }

    private static class FetchTask extends AsyncTask<URL, Void, Void> {

        private File file;
        private Player player;

        FetchTask(File dir, Player player) {
            file = new File(dir, "a.webm");
            this.player = player;
        }

        @Override
        protected Void doInBackground(URL ...urls) {
            URL url = urls[0];
            try {
                try (InputStream cis = url.openStream();
                     OutputStream fos = new FileOutputStream(file)) {

                    byte[] buf = new byte[4096];
                    int rd, totrd = 0;
                    while ((rd = cis.read(buf)) > 0) {
                        fos.write(buf, 0, rd);
                        totrd += rd;
                        Log.d(TAG, "fetch: " + totrd + " bytes");
                    }
                }
            }
            catch (IOException e) {
                Log.e(TAG, "fetch failed", e);
            }
            return null;
        }

        @Override
        protected void onPostExecute(Void aVoid) {
            if (player != null)
                player.playMedia(Uri.parse("http://localhost:2224/cache/a.webm"));
        }
    }

    private Response ok() {
        return newFixedLengthResponse(Response.Status.OK, "text/plain", "ok");
    }

    private Response error(String msg) {
        return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", msg);
    }

    private Response handlePost(IHTTPSession session) {
        Map<String, String> files = new HashMap<>();
        try {
            session.parseBody(files);
        }
        catch (IOException e) { Log.e(TAG, "serve: read error", e); }
        catch (ResponseException e) { Log.e(TAG, "serve: bad response", e); }

        String postData = files.get("postData");

        if (postData == null)
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain","missing request body");
        else if (session.getUri().startsWith("/playlist"))
            return playlist(postData);
        else
            return sendToJS(postData);
    }

    private Response sendToJS(String req) {

        int id = nextReqId++;

        final String msg = "{\"type\": \"request\", \"id\": " + id + ", \"inner\": " + req + "}";

        PipedInputStream data = new PipedInputStream();
        PipedOutputStream pipe = new PipedOutputStream();
        try {
            pipe.connect(data);
            synchronized (this) {
                pendingRequests.put(id, pipe);
            }
            context.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    context.jsCall(msg);
                }
            });
            return newChunkedResponse(Response.Status.OK, "text/json", data);
        }
        catch (IOException e) {
            Log.e(TAG, "Server.serve", e);
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", e.toString());
        }
    }

    public void postResponse(int id, String resp) {
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

    private Response playlist(String playlistData) {
        try {
            Playlist playlist = Playlist.fromJSON(playlistData);
            context.player.playFromList(playlist);
            return ok();
        }
        catch (JSONException e) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "JSON format error: " + e);
        }
    }

    @Override
    protected WebSocket openWebSocket(IHTTPSession handshake) {
        String path = handshake.getUri();
        Log.d(TAG, "websocket incoming [" + path + "]");

        if (path.startsWith("/cache/")) {
            FileStoreWebSocketConnection ws = new FileStoreWebSocketConnection(
                    handshake, new File(cacheDir(), basename(path)));

            /*
            ws.setFileStoreListener(new FileStoreWebSocketConnection.FileStoreListener() {
                @Override
                public void onStored(final File file) {
                    Log.d(TAG, "playing (from cache): " + file.getPath());
                    context.runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            context.player.playFile(file);
                        }
                    });
                }
            });
            */

            return ws;
        }
        else
            return new WebSocketConnection(handshake);
    }

    private static String basename(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private File cacheDir() {
        File d = new File(context.getCacheDir(), "music");
        if (!d.isDirectory() && !d.mkdirs()) {
            Log.w(TAG, "'" + d.getPath() + "': failed to create directory");
        }
        return d;
    }

}
