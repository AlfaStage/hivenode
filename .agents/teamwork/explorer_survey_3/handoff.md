# Handoff Report — Explorer Survey 3 (Client Applications Audit)

**Agent**: Survey Explorer 3  
**Working Directory**: `c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_3`  
**Milestone**: M1_Architectural_Survey  
**Target Scope**: `hiveminer-app/`, `hivenode-app/`, `hivedocker/`  
**Report Artifact**: `c:\Users\theja\HiveNode\.agents\teamwork\explorer_survey_3\survey_report.md`  

---

## 1. Observation

Direct code inspections, line mappings, and execution attempts yielded the following verbatim findings:

1. **Android 14+ Foreground Service Termination**:
   - `hivenode-app/plugins/withNotifeeForegroundServiceType.js` lines 14-46 implements Android manifest override:
     ```javascript
     const attrs = {
       'android:name': SERVICE_NAME,
       'android:exported': 'false',
       'android:foregroundServiceType': 'dataSync',
       'tools:replace': 'android:foregroundServiceType',
     };
     ```
     Registered in `hivenode-app/app.json` line 60: `"./plugins/withNotifeeForegroundServiceType"`.
   - `hiveminer-app/app.json` lines 35-52 omits this plugin completely. No `plugins/` directory exists in `hiveminer-app/`.
2. **Missing Notification Permission**:
   - `hiveminer-app/app.json` lines 16-22 lists:
     ```json
     "permissions": [
       "android.permission.INTERNET",
       "android.permission.FOREGROUND_SERVICE",
       "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
       "android.permission.WAKE_LOCK",
       "android.permission.CAMERA"
     ]
     ```
     `android.permission.POST_NOTIFICATIONS` is absent. In `hivenode-app/app.json` line 20, it is present.
3. **Missing Worklets Dependency**:
   - `hivenode-app/package.json` line 34 and 39:
     ```json
     "react-native-reanimated": "~4.1.1",
     "react-native-worklets": "0.5.1"
     ```
   - `hiveminer-app/package.json` line 35:
     ```json
     "react-native-reanimated": "~4.1.1"
     ```
     `react-native-worklets` is completely absent.
4. **Missing Revocation Reset (`forceLogout`)**:
   - In `hivenode-app/src/app/index.tsx` lines 436-448 & 720-728, `forceLogout()` clears `token`, `tunnelSecret`, `nodeId`, `serverIp`, and invokes `AsyncStorage.multiRemove(...)`.
   - In `hiveminer-app/src/app/index.tsx` lines 724-729:
     ```typescript
     if (e.reason === "KICKED") {
       intentionalLogout.current = true;
       if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
       Alert.alert("Acesso interrompido", "Verifique o estado do aparelho no painel.");
       return;
     }
     ```
     `forceLogout()` does not exist and is never called.
5. **Race Condition in `TcpSocket.createConnection` on Cancelled DIAL**:
   - `hiveminer-app/src/app/index.tsx` lines 644-650 & `hivenode-app/src/app/index.tsx` lines 640-646:
     The callback does not check whether `activeSockets[connId]` was deleted by an intervening `{ type: "CLOSE" }` message before dispatching `{ type: "DIAL_OK", connId }`.
6. **No Backpressure Circuit Breaker**:
   - `hivedocker/server.js` lines 60 & 82 guards buffers with `socket.writableLength > 1048576` and `ws.bufferedAmount > 1048576`.
   - `hiveminer-app/src/app/index.tsx` lines 652-678 and `hivenode-app/src/app/index.tsx` lines 648-674 invoke `send(outBuffer)` and `activeSockets[connId].write(payload)` without checking buffer saturation.
7. **Environment Constraint for Docker Execution**:
   - Execution of `docker ps` returned code 1:
     `permission denied while trying to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
     Indicating host Docker daemon socket is not permitted for the subagent's execution process.

---

## 2. Logic Chain

1. **Premise 1**: On Android 14+ (API 34), services using the default `@notifee/react-native` manifest attribute `shortService` are strictly capped at 3 minutes before the system triggers `onTimeout()` and kills the app.
   - **Observation Reference**: 1.1 & 1.2.
   - **Inference**: Because `hiveminer-app` lacks `withNotifeeForegroundServiceType` and `POST_NOTIFICATIONS`, any installation on Android 14+ will crash after 3 minutes of background operation.
2. **Premise 2**: Reanimated 4.x relies on native JSI worklets provided by `react-native-worklets`.
   - **Observation Reference**: 1.3.
   - **Inference**: Building or bundling `hiveminer-app` will fail to resolve `react-native-worklets`, resulting in build failures or runtime crashes.
3. **Premise 3**: When an administrative or user action removes a device in the Web Panel, the broker sends a WebSocket close frame with `KICKED`.
   - **Observation Reference**: 1.4.
   - **Inference**: In `hiveminer-app`, because `forceLogout` is missing, the kicked credentials remain in storage and state. The app remains stuck showing a defunct nodeId and attempts to reconnect on restart, locking out the user from scanning a new QR code.
4. **Premise 4**: High-bandwidth TCP traffic creates rapid bursts of incoming and outgoing data.
   - **Observation Reference**: 1.6.
   - **Inference**: Without checking `ws.bufferedAmount` or throttling TCP writes, high-bandwidth streaming exhausts the JavaScript heap in React Native, leading directly to Out-Of-Memory (OOM) crashes on mobile devices.
5. **Premise 5**: Asynchronous socket creation creates a window between `TcpSocket.createConnection` invocation and socket establishment.
   - **Observation Reference**: 1.5.
   - **Inference**: If a stream is aborted by the broker during this window, the client executes cleanup, but the subsequent delayed connection callback fires `DIAL_OK`, creating protocol desynchronization.

---

## 3. Caveats

1. **Native Docker Diagnostics**: The Docker daemon named pipe on Windows (`npipe:////./pipe/dockerDesktopLinuxEngine`) returned access denied; full runtime containerized builds (`eas build --local` or native gradle compile inside container) could not be executed within this subagent's shell session. All analysis was conducted via exhaustive static code, AST, dependency tree, and log audit.
2. **iOS Binary Inspection**: Since this audit took place on a Windows host, iOS CocoaPods / Xcode native build compilation was evaluated via static inspection of `scripts/harden-tcp.cjs` and configuration files rather than local Xcode builds.
3. **No Project Source Code Modification**: Under the strict read-only constraint of this audit, no files outside `.agents/teamwork/explorer_survey_3/` were altered.

---

## 4. Conclusion

The audit identified **18 distinct defects and structural gaps** across `hiveminer-app`, `hivenode-app`, and `hivedocker`.
- **`hivedocker`** is the most stable and robust component, featuring pre-dial DNS SSRF resolution, backpressure breakers, and cleanly implemented device-code authorization, with minor issues limited to unused dependencies (`crypto-js`) and leftover debug files (`unescape.js`).
- **`hivenode-app`** possesses the necessary native configurations for Android background services (`withNotifeeForegroundServiceType` and `POST_NOTIFICATIONS`), but suffers from lack of backpressure management, race conditions on cancelled DIAL requests, and leftover build logs.
- **`hiveminer-app`** exhibits multiple critical defects inherited from an incomplete port of `hivenode-app`, missing the Foreground Service type override (crashing on Android 14+), missing `POST_NOTIFICATIONS`, missing `react-native-worklets` for Reanimated 4, and lacking `forceLogout()` on revocation.

All findings have been fully documented with exact file paths, line numbers, and impact assessments in `survey_report.md`.

---

## 5. Verification Method

To independently reproduce and verify these findings:

1. **Verify Missing Foreground Service Type in `hiveminer-app`**:
   - Check directory: `dir c:\Users\theja\HiveNode\hiveminer-app\plugins` (Directory does not exist).
   - Inspect: `c:\Users\theja\HiveNode\hiveminer-app\app.json` lines 35-52. Confirm absence of `withNotifeeForegroundServiceType`.
2. **Verify Missing Worklets**:
   - Inspect: `c:\Users\theja\HiveNode\hiveminer-app\package.json` line 35. Confirm `react-native-worklets` is missing.
3. **Verify Revocation Bug (`KICKED`)**:
   - Grep: Search for `forceLogout` in `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx` (0 occurrences) vs `c:\Users\theja\HiveNode\hivenode-app\src\app\index.tsx` (lines 436 and 726).
4. **Verify Backpressure Omission**:
   - Search for `bufferedAmount` in `c:\Users\theja\HiveNode\hiveminer-app\src\app\index.tsx` (0 occurrences) vs `c:\Users\theja\HiveNode\hivedocker\server.js` line 82.
