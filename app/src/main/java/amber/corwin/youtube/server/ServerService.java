package amber.corwin.youtube.server;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import android.util.SparseArray;

import androidx.annotation.Nullable;

import java.io.IOException;
import java.io.OutputStream;

import amber.corwin.youtube.MainActivity;
import fi.iki.elonen.NanoWSD;

public class ServerService extends Service {

    private static final String TAG = "Android.Tube";

    static class MeekHTTPD extends NanoWSD {

        private static final String TAG = "HTTPD";

        private Context context;

        public MeekHTTPD(Context context) {
            super(2225);
            this.context = context;
        }

        @Override
        public Response serve(IHTTPSession session) {
            Method method = session.getMethod();
            String path = session.getUri();

            Log.i(TAG, "" + method.name() + " " + path);

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            context.startActivity(intent);

            return super.serve(session);
        }

        @Override
        protected WebSocket openWebSocket(IHTTPSession handshake) {
            return null;
        }
    }

    MeekHTTPD httpd;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        httpd = new MeekHTTPD(this);
        try {
            httpd.start();
        } catch (IOException e) {
            Log.e(TAG, "ServerService", e);
        }
        return super.onStartCommand(intent, flags, startId);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
