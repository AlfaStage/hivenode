package br.alfastage.hivenode.legacy;

import android.content.Context;
import android.content.SharedPreferences;

public final class PrefStore {
    private static final String NAME = "hivenode";
    private final SharedPreferences sp;

    public PrefStore(Context ctx) {
        sp = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    public String getToken()       { return sp.getString("token", null); }
    public String getBrokerHost()  { return sp.getString("brokerHost", "broker.hivenode.alfastage.com.br"); }
    public String getNodeId()      { return sp.getString("nodeId", null); }
    public String getTunnelSecret(){ return sp.getString("tunnelSecret", "hivenode_secret_key"); }
    public String getUserEmail()   { return sp.getString("userEmail", null); }
    public String getUserRole()    { return sp.getString("userRole", null); }
    public boolean isAutoStart()   { return sp.getBoolean("autoStart", true); }

    public void saveLogin(String token, String brokerHost, String nodeId, String tunnelSecret,
                          String userEmail, String userRole) {
        sp.edit()
          .putString("token", token)
          .putString("brokerHost", brokerHost)
          .putString("nodeId", nodeId)
          .putString("tunnelSecret", tunnelSecret)
          .putString("userEmail", userEmail)
          .putString("userRole", userRole)
          .apply();
    }
    
    public void saveNodeId(String nodeId) {
        sp.edit().putString("nodeId", nodeId).apply();
    }

    public void clear() {
        sp.edit().clear().apply();
    }
}
