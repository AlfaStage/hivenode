package br.alfastage.hivenode.legacy;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public final class LoginApi {
    public static final String DEFAULT_BASE = "https://hivenode.alfastage.com.br";

    private final String baseUrl;
    public LoginApi(String baseUrl) { this.baseUrl = baseUrl; }

    public static class LoginResponse {
        public String token;
        public String userEmail;
        public String userRole;
        public String nodeId;
        public String tunnelSecret;
    }

    // POST /api/auth/login {"email","password"} → {"token","user"}
    public LoginResponse login(String email, String password) throws Exception {
        JSONObject body = new JSONObject();
        body.put("email", email).put("password", password);
        JSONObject resp = post("/api/auth/login", body, null);

        LoginResponse r = new LoginResponse();
        r.token = resp.getString("token");
        JSONObject user = resp.getJSONObject("user");
        r.userEmail = user.getString("email");
        r.userRole = user.getString("role");
        r.tunnelSecret = user.optString("tunnelSecret", "hivenode_secret_key");
        r.nodeId = user.optString("nodeId", null);
        return r;
    }

    // POST /api/auth/device-code/generate {"type":"miner|proxy"}
    public JSONObject generateDeviceCode(String type) throws Exception {
        JSONObject body = new JSONObject();
        body.put("type", type);
        return post("/api/auth/device-code/generate", body, null);
    }

    // POST /api/auth/device-code/poll {"deviceCode":...}
    public JSONObject pollDeviceCode(String deviceCode) throws Exception {
        JSONObject body = new JSONObject();
        body.put("deviceCode", deviceCode);
        return post("/api/auth/device-code/poll", body, null);
    }

    // POST /api/auth/pair-code {"pairCode":"HV-XXXX"}
    public JSONObject pairCode(String code) throws Exception {
        JSONObject body = new JSONObject();
        body.put("pairCode", code.toUpperCase());
        return post("/api/auth/pair-code", body, null);
    }

    // POST /api/auth/qr-login {"linkToken":...}
    public LoginResponse qrLogin(String linkToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("linkToken", linkToken);
        JSONObject resp = post("/api/auth/qr-login", body, null);

        LoginResponse r = new LoginResponse();
        r.token = resp.getString("token");
        JSONObject user = resp.getJSONObject("user");
        r.userEmail = user.getString("email");
        r.userRole = user.getString("role");
        r.tunnelSecret = user.optString("tunnelSecret", "hivenode_secret_key");
        r.nodeId = user.optString("nodeId", null);
        return r;
    }
    
    public JSONObject registerNode(String deviceModel, String type, String token) throws Exception {
        JSONObject body = new JSONObject();
        body.put("deviceModel", deviceModel);
        body.put("type", type);
        return post("/api/nodes/register", body, token);
    }

    private JSONObject post(String path, JSONObject body, String token) throws Exception {
        URL url = new URL(baseUrl + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        if (token != null) {
            conn.setRequestProperty("Authorization", "Bearer " + token);
        }
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setDoOutput(true);
        
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes("UTF-8"));
        }
        
        int code = conn.getResponseCode();
        BufferedReader br = new BufferedReader(
            new InputStreamReader(code >= 400 ? conn.getErrorStream() : conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        
        String respStr = sb.toString();
        if (code >= 400) {
            throw new RuntimeException("HTTP " + code + ": " + respStr);
        }
        
        JSONObject envelope = new JSONObject(respStr);
        if (envelope.has("data")) return envelope.getJSONObject("data");
        return envelope;
    }
}
