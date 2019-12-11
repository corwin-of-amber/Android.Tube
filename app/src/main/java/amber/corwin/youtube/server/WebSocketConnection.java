package amber.corwin.youtube.server;

import android.util.Log;

import java.io.IOException;
import java.util.Timer;
import java.util.TimerTask;

import fi.iki.elonen.NanoWSD;



public class WebSocketConnection extends NanoWSD.WebSocket {

    protected static final String TAG = "WebSocketConnection";
    private static final byte[] PING_PAYLOAD = "AH".getBytes();

    private TimerTask ping = null;

    WebSocketConnection(NanoWSD.IHTTPSession handshakeRequest) {
        super(handshakeRequest);
    }

    @Override
    protected void onOpen() {
        Log.d(TAG, "websocket open [" + this.getHandshakeRequest().getUri() + "]");

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
        if (ping != null) { ping.cancel(); ping = null; }
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
        Log.d(TAG, "websocket msg: " + message.getTextPayload());
    }

}
