package amber.corwin.youtube.server;

import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

import fi.iki.elonen.NanoWSD;



public class FileStoreWebSocketConnection extends WebSocketConnection {

    private File file;
    private OutputStream store;

    private FileStoreListener fileStoreListener;

    FileStoreWebSocketConnection(NanoWSD.IHTTPSession handshakeRequest,
                                 File target) {
        super(handshakeRequest);
        file = target;
    }

    void setFileStoreListener(FileStoreListener listener) {
        this.fileStoreListener = listener;
    }

    @Override
    protected void onOpen() {
        super.onOpen();

        try {
            store = new FileOutputStream(file);
        }
        catch (IOException e) { Log.e(TAG, "store", e); }
    }

    @Override
    protected void onClose(NanoWSD.WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
        super.onClose(code, reason, initiatedByRemote);

        try {
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
    protected void onMessage(NanoWSD.WebSocketFrame message) {
        byte[] buf = message.getBinaryPayload();
        //Log.d(TAG, "websocket msg (" + buf.length + ")");
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
