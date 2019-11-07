package amber.corwin.youtube.server;


import android.util.Log;
import android.util.SparseArray;

import org.json.JSONException;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.HashMap;
import java.util.Map;

import amber.corwin.youtube.MainActivity;
import amber.corwin.youtube.Playlist;
import amber.corwin.youtube.VolumeSetting;
import fi.iki.elonen.NanoWSD;



public class HTTPD extends NanoWSD {

    private static final String TAG = "HTTPD";

    private int nextReqId = 3;
    private SparseArray<OutputStream> pendingRequests = new SparseArray<>();

    private MainActivity context;

    public HTTPD(MainActivity context) { super(2224); this.context = context; }

    @Override
    public Response serve(IHTTPSession session) {
        Method method = session.getMethod();
        String path = session.getUri();

        if (path.equals("/") && method == Method.GET && !isWebsocketRequested(session))
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

    private Response ok() {
        return newFixedLengthResponse(Response.Status.OK, "text/plain", "ok");
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
        Log.d(TAG, "websocket incoming");
        return new WebSocketConnection(handshake);
    }

}
