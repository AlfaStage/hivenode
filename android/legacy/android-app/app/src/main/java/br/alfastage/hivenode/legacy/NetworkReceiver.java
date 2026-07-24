package br.alfastage.hivenode.legacy;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NetworkReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrefStore prefs = new PrefStore(context);
        if (prefs.getToken() == null) return;

        // Reinicia Service - Go client detecta server fechado e reconecta c/ backoff.
        Intent svc = new Intent(context, TunnelService.class);
        context.stopService(svc);
        context.startService(svc);
    }
}
