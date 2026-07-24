package br.alfastage.hivenode.legacy;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiManager;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.app.NotificationCompat;
import android.util.Log;

import mobile.Tunnel;
import mobile.StatusCallback;
import mobile.Mobile;

public class TunnelService extends Service {
    private static final String TAG = "Hive";
    private static final int NOTIF_ID = 10001;

    private static Tunnel tunnel;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private PrefStore prefs;
    private Thread pollerThread;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new PrefStore(this);

        // WakeLock partial - não adormece CPU
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hivenode:tunnel");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();

        // WifiLock high perf - não deixa Wi-Fi antena "dormir"
        WifiManager wm = (WifiManager) getSystemService(Context.WIFI_SERVICE);
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "hivenode:wifi");
        wifiLock.setReferenceCounted(false);
        wifiLock.acquire();

        tunnel = Mobile.newTunnel();
        tunnel.setStatusCallback(new StatusCallback() {
            @Override public void onStatus(final String s) {
                Log.i(TAG, "Status: " + s);
                updateNotification(s);
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification("HiveNode ativo"));

        if (prefs.getNodeId() == null) {
            Log.w(TAG, "sem nodeId vinculado");
            stopSelf();
            return START_STICKY;
        }

        tunnel.start(prefs.getBrokerHost(), prefs.getNodeId(), prefs.getTunnelSecret());
        startPoller();
        return START_STICKY;
    }

    private void startPoller() {
        if (pollerThread != null && pollerThread.isAlive()) return;
        
        pollerThread = new Thread() {
            @Override public void run() {
                while (!Thread.interrupted()) {
                    try { Thread.sleep(30000); } catch (InterruptedException e) { break; }
                    String ip = getNetworkIp();
                    String netType = getNetworkType();
                    tunnel.sendTelemetry(ip, netType);

                    String status = tunnel.status();
                    updateNotification(status);
                }
            }
        };
        pollerThread.start();
    }

    private String getNetworkIp() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        return ni == null ? "desconhecido" : (ni.getExtraInfo() != null ? ni.getExtraInfo() : "online");
    }

    private String getNetworkType() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo ni = cm.getActiveNetworkInfo();
        if (ni == null) return "OFFLINE";
        switch (ni.getType()) {
            case ConnectivityManager.TYPE_WIFI: return "WIFI";
            case ConnectivityManager.TYPE_MOBILE: return "MOBILE_" + ni.getSubtypeName();
            default: return "OTHER";
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (pollerThread != null) pollerThread.interrupt();
        if (tunnel != null) tunnel.stop();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        tunnel = null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private Notification buildNotification(String msg) {
        Intent i = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, i,
            PendingIntent.FLAG_UPDATE_CURRENT);
            
        return new NotificationCompat.Builder(this)
            .setContentTitle("HiveNode Legacy")
            .setContentText(msg)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
    }

    private void updateNotification(final String msg) {
        ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
            .notify(NOTIF_ID, buildNotification(msg));
    }

    public static Tunnel getTunnel() { return tunnel; }
}
