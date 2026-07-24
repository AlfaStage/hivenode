package br.alfastage.hivenode.legacy;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import mobile.Tunnel;

public class MainActivity extends Activity {
    private PrefStore prefs;
    private EditText txtEmail, txtPassword;
    private Thread pollerThread;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = new PrefStore(this);

        if (prefs.getToken() != null && prefs.getNodeId() != null) {
            showStatus();
            startService(new Intent(this, TunnelService.class));
            return;
        }

        showLogin();
    }
    
    private void showLogin() {
        setContentView(R.layout.activity_main);
        
        txtEmail = (EditText) findViewById(R.id.txtEmail);
        txtPassword = (EditText) findViewById(R.id.txtPassword);
        Button btnLogin = (Button) findViewById(R.id.btnLogin);
        Button btnDeviceCode = (Button) findViewById(R.id.btnDeviceCode);
        Button btnPairCode = (Button) findViewById(R.id.btnPairCode);

        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                doLogin(txtEmail.getText().toString(), txtPassword.getText().toString());
            }
        });

        btnDeviceCode.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                startDeviceCodeFlow();
            }
        });

        btnPairCode.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                showPairCodeDialog();
            }
        });
    }

    private void ensureNodeId(final LoginApi api, final LoginApi.LoginResponse r) throws Exception {
        if (r.nodeId != null) return;
        
        String deviceModel = Build.MODEL + " Android " + Build.VERSION.RELEASE;
        JSONObject resp = api.registerNode(deviceModel, "BYOD", r.token);
        String nodeId = resp.getJSONObject("node").getString("id");
        r.nodeId = nodeId;
    }

    private void doLogin(final String email, final String password) {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                    final LoginApi.LoginResponse r = api.login(email, password);
                    
                    ensureNodeId(api, r);
                    
                    prefs.saveLogin(r.token, prefs.getBrokerHost(), r.nodeId,
                                    r.tunnelSecret, r.userEmail, r.userRole);
                                    
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showStatus();
                            startService(new Intent(MainActivity.this, TunnelService.class));
                        }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Toast.makeText(MainActivity.this, "Erro: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }
    
    private void startDeviceCodeFlow() {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    final LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                    final JSONObject dc = api.generateDeviceCode("proxy");
                    final String userCode = dc.getString("userCode");
                    final String deviceCode = dc.getString("deviceCode");
                    final String uri = dc.getString("verificationUri");
    
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showDialogMsg("Código: " + userCode,
                                    "Vá em:\n" + uri + "\ne digite o código. Você tem 5 min.");
                        }
                    });
    
                    // Poll 3s até 5 min
                    long deadline = System.currentTimeMillis() + 5 * 60 * 1000;
                    while (System.currentTimeMillis() < deadline) {
                        JSONObject poll = api.pollDeviceCode(deviceCode);
                        if ("success".equals(poll.optString("status"))) {
                            String linkToken = poll.getString("token");
                            LoginApi.LoginResponse r = api.qrLogin(linkToken);
                            ensureNodeId(api, r);
                            
                            prefs.saveLogin(r.token, prefs.getBrokerHost(),
                                           r.nodeId, r.tunnelSecret,
                                           r.userEmail, r.userRole);
                            runOnUiThread(new Runnable() {
                                @Override public void run() {
                                    showStatus();
                                    startService(new Intent(MainActivity.this, TunnelService.class));
                                }
                            });
                            return;
                        }
                        Thread.sleep(3000);
                    }
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showDialogMsg("Expirado", "Reinicie o processo.");
                        }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showDialogMsg("Erro", e.getMessage());
                        }
                    });
                }
            }
        }).start();
    }
    
    private void showPairCodeDialog() {
        final EditText input = new EditText(this);
        input.setHint("Ex: HV-ABCD");
        new AlertDialog.Builder(this)
            .setTitle("Digite o Pair Code")
            .setMessage("Gere o código no painel do HiveNode e digite aqui.")
            .setView(input)
            .setPositiveButton("OK", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface dialog, int whichButton) {
                    doPairCode(input.getText().toString());
                }
            })
            .setNegativeButton("Cancelar", null)
            .show();
    }
    
    private void doPairCode(final String pairCode) {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    LoginApi api = new LoginApi(LoginApi.DEFAULT_BASE);
                    JSONObject pair = api.pairCode(pairCode);
                    String linkToken = pair.getString("linkToken");
                    LoginApi.LoginResponse r = api.qrLogin(linkToken);
                    
                    ensureNodeId(api, r);
                    
                    prefs.saveLogin(r.token, prefs.getBrokerHost(),
                                    r.nodeId, r.tunnelSecret,
                                    r.userEmail, r.userRole);
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            showStatus();
                            startService(new Intent(MainActivity.this, TunnelService.class));
                        }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Toast.makeText(MainActivity.this, "Erro: " + e.getMessage(),
                                    Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }
    
    private void showDialogMsg(String title, String message) {
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show();
    }

    private void showStatus() {
        setContentView(R.layout.activity_status);
        TextView tv = (TextView) findViewById(R.id.txtStatusTitle);
        tv.setText("Conectado como " + prefs.getUserEmail() + "\nNodeId: " + prefs.getNodeId());

        final TextView rxTx = (TextView) findViewById(R.id.txtRxTx);
        Button stopBtn = (Button) findViewById(R.id.btnStop);
        stopBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                stopService(new Intent(MainActivity.this, TunnelService.class));
                prefs.clear();
                
                if (pollerThread != null) pollerThread.interrupt();
                showLogin();
            }
        });

        pollerThread = new Thread() {
            @Override public void run() {
                while (!Thread.interrupted()) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Tunnel t = TunnelService.getTunnel();
                            if (t != null) {
                                rxTx.setText("rx=" + t.rxBytes() + " tx=" + t.txBytes());
                            } else {
                                rxTx.setText("Service not running");
                            }
                        }
                    });
                    try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
                }
            }
        };
        pollerThread.start();
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (pollerThread != null) pollerThread.interrupt();
    }
}
