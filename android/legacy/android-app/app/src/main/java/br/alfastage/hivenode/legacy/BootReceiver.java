package br.alfastage.hivenode.legacy;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        PrefStore prefs = new PrefStore(context);
        if (prefs.getToken() != null && prefs.getNodeId() != null) {
            Log.i("Hive", "Boot recebido - iniciando service");
            context.startService(new Intent(context, TunnelService.class));
        }
    }
}
