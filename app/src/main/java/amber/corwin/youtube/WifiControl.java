package amber.corwin.youtube;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.util.Log;
import android.widget.Toast;

import java.util.List;

public class WifiControl {

    private Context ctx;
    private WifiManager wifiManager;
    private boolean wifiEnabled = true;

    private static final String SSID = "Amit"; // Replace with your SSID
    private static final String PASSWORD = "rab29bit"; // Replace with your password
/*
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);


        Button toggleButton = findViewById(R.id.toggleButton);
        toggleButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleWiFi();
            }
        });*/

    public WifiControl(Context ctx) {
        wifiManager = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);

        // Register BroadcastReceiver to track Wi-Fi state changes
        ctx.registerReceiver(wifiReceiver, new IntentFilter(WifiManager.WIFI_STATE_CHANGED_ACTION));
    }

    public void toggleWiFi() {
        if (wifiEnabled) {
            // If Wi-Fi is enabled, disable it
            wifiManager.setWifiEnabled(false);
            wifiEnabled = false;
        } else {
            // If Wi-Fi is disabled, enable it and connect to the specified SSID
            wifiManager.setWifiEnabled(true);
            connectToSavedNetwork();
        }
    }

    public void connect() {
        if (!wifiEnabled) wifiManager.setWifiEnabled(true);
        connectToSavedNetwork();
    }

    public void disconnect() {
        wifiManager.disconnect();
    }

    private static final long RECONNECT_INTERVAL = 10 * 60 * 1000; // 10 minutes

    public void watchdog() {
        watchdog(RECONNECT_INTERVAL);
    }

    public void watchdog(long reconnectInterval) {
        Handler handler = new Handler();
        Runnable reconnectRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isConnected()) connect();
                handler.postDelayed(this, reconnectInterval);
            }
        };
        handler.postDelayed(reconnectRunnable, reconnectInterval);
    }

    public boolean isConnected() {
        int wifiState = wifiManager.getWifiState();
        if (wifiState == WifiManager.WIFI_STATE_ENABLED) {
            WifiInfo wifiInfo = wifiManager.getConnectionInfo();
            return (wifiInfo.getNetworkId() != -1);
            //String ssid = wifiInfo.getSSID();
        }
        else return false;
    }

    private void connectToSSID() {
        WifiConfiguration wifiConfig = new WifiConfiguration();
        wifiConfig.SSID = "\"" + SSID + "\"";
        wifiConfig.preSharedKey = "\"" + PASSWORD + "\"";

        int netId = wifiManager.addNetwork(wifiConfig);
        wifiManager.disconnect();
        wifiManager.enableNetwork(netId, true);
        wifiManager.reconnect();
    }

    private void connectToSavedNetwork() {
        List<WifiConfiguration> configuredNetworks = wifiManager.getConfiguredNetworks();

        for (WifiConfiguration config : configuredNetworks) {
            if (config.SSID != null && config.SSID.equals("\"" + SSID + "\"")) {
                wifiManager.enableNetwork(config.networkId, true);
                Log.d("APP", "Connecting to " + SSID);
                break;
            }
        }
    }

    // BroadcastReceiver to listen for Wi-Fi state changes
    private final BroadcastReceiver wifiReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            int wifiState = intent.getIntExtra(WifiManager.EXTRA_WIFI_STATE, WifiManager.WIFI_STATE_UNKNOWN);

            switch (wifiState) {
                case WifiManager.WIFI_STATE_ENABLED:
                    wifiEnabled = true;
                    Log.d("WiFi", "Wi-Fi enabled");
                    break;
                case WifiManager.WIFI_STATE_DISABLED:
                    wifiEnabled = false;
                    //Log.d("WiFi", "Wi-Fi disabled");
                    break;
            }
        }
    };

    protected void destroy() {
        ctx.unregisterReceiver(wifiReceiver);
    }
}
