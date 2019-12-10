package amber.corwin.youtube.server;

import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Timer;
import java.util.TimerTask;

import fi.iki.elonen.NanoWSD;

import amber.corwin.youtube.MainActivity;



public class WebSocketConnection extends NanoWSD.WebSocket {

    private static final String TAG = "WebSocketConnection";
    private static final byte[] PING_PAYLOAD = "AH".getBytes();

    private MainActivity context;
    private File file;
    private OutputStream store;

    private FileStoreListener fileStoreListener;

    private TimerTask ping = null;

    WebSocketConnection(NanoWSD.IHTTPSession handshakeRequest, MainActivity context) {
        super(handshakeRequest);
        this.context = context;
    }

    public void setFileStoreListener(FileStoreListener listener) {
        this.fileStoreListener = listener;
    }

    @Override
    protected void onOpen() {
        Log.d(TAG, "websocket open [" + this.getHandshakeRequest().getUri() + "]");

        try {
            file = new File(context.getCacheDir(), "a.webm");
            store = new FileOutputStream(file);
        }
        catch (IOException e) { Log.e(TAG, "store", e); }

        if (ping == null) {
            ping = new TimerTask() {
                @Override
                public void run(){
                    try { ping(PING_PAYLOAD); }
                    catch (IOException e) { ping.cancel(); }
                }
            };
            new Timer().schedule(ping, 1000, 1000);
        }
    }

    @Override
    protected void onClose(NanoWSD.WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
        Log.d(TAG, "websocket close [" + code + "] " + reason + " ("
                + (initiatedByRemote ? "client" : "server") + ")");
        try {
            if (ping != null) { ping.cancel(); ping = null; }
            if (store != null) { store.close(); store = null; }
            if (file != null && fileStoreListener != null) {
                fileStoreListener.onStored(file);
            }
        }
        catch (IOException e) {
            Log.e(TAG, "store", e);
        }
    }

    @Override
    protected void onPong(NanoWSD.WebSocketFrame pong) {

    }

    @Override
    protected void onException(IOException exception) {
        Log.e(TAG, "websocket error", exception);
    }

    @Override
    protected void onMessage(NanoWSD.WebSocketFrame message) {
        byte[] buf = message.getBinaryPayload();
        Log.d(TAG, "websocket msg (" + buf.length + ")");
        try {
            if (store != null)
                store.write(buf);
        }
        catch (IOException e) { Log.e(TAG, "store", e); }
    }

    public interface FileStoreListener {
        void onStored(File file);
    }
}
