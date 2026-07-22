import { useState, useEffect, useRef } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Pressable, Modal
} from "react-native";
import { StatusBar } from "expo-status-bar";
import TcpSocket from "react-native-tcp-socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Network from "expo-network";
import * as Battery from "expo-battery";
import * as IntentLauncher from "expo-intent-launcher";
import NetInfo from '@react-native-community/netinfo';
import CryptoJS from "crypto-js";

let notifee: any = null;
let AndroidImportance: any = null;

try {
  const NotifeeModule = require('@notifee/react-native');
  notifee = NotifeeModule.default;
  AndroidImportance = NotifeeModule.AndroidImportance;

  notifee.registerForegroundService((notification: any) => {
    return new Promise(() => {
      // Promessa eterna: mantem o App, o WebSocket e o TCP ativos.
    });
  });
} catch (e) {
  console.warn("⚠️ Notifee native module is not available (running in Expo Go). Background service is disabled.");
}

const getApiUrl = (address: string, path: string) => {
  const isProd = address.includes("alfastage.com.br");
  const baseDomain = address.replace("api.", "");
  return isProd ? `https://${baseDomain}/api${path}` : `http://${address}:3000/api${path}`;
};

const getWsUrl = (address: string, nodeId: string) => {
  const isProd = address.includes("alfastage.com.br");
  const hmacSig = CryptoJS.HmacSHA256(nodeId, "hivenode_secret_key").toString(CryptoJS.enc.Hex);
  return isProd ? `wss://${address}/tunnel?nodeId=${nodeId}&sig=${hmacSig}` : `ws://${address}:10001/tunnel?nodeId=${nodeId}&sig=${hmacSig}`;
};

// Funções Nativas de Base64 para evitar a dependência ausente de Buffer
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const encodeBase64 = (input: Uint8Array | number[]): string => {
  let str = '';
  for (let i = 0; i < input.length; i += 3) {
    const b1 = input[i];
    const b2 = i + 1 < input.length ? input[i + 1] : 0;
    const b3 = i + 2 < input.length ? input[i + 2] : 0;
    
    const block = (b1 << 16) | (b2 << 8) | b3;
    
    str += chars[(block >> 18) & 63];
    str += chars[(block >> 12) & 63];
    str += i + 1 < input.length ? chars[(block >> 6) & 63] : '=';
    str += i + 2 < input.length ? chars[block & 63] : '=';
  }
  return str;
};

const decodeBase64 = (input: string): Uint8Array => {
  const str = input.replace(/=+$/, '');
  const output = [];
  for (let i = 0; i < str.length; i += 4) {
    const c1 = chars.indexOf(str.charAt(i));
    const c2 = i + 1 < str.length ? chars.indexOf(str.charAt(i + 1)) : 0;
    const c3 = i + 2 < str.length ? chars.indexOf(str.charAt(i + 2)) : 0;
    const c4 = i + 3 < str.length ? chars.indexOf(str.charAt(i + 3)) : 0;
    
    const block = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    
    output.push((block >> 16) & 255);
    if (i + 2 < str.length) output.push((block >> 8) & 255);
    if (i + 3 < str.length) output.push(block & 255);
  }
  return new Uint8Array(output);
};

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado Sessão
  const [serverIp, setServerIp] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [nodeName, setNodeName] = useState("HiveNode Mobile");
  
  // Renomear (UI)
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [editName, setEditName] = useState("");

  // Telemetria de Rede
  const [networkIp, setNetworkIp] = useState("...");
  const [networkType, setNetworkType] = useState("...");
  
  // Câmera
  const [permission, requestPermission] = useCameraPermissions();
  const [focusTrigger, setFocusTrigger] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Inputs Forms
  const [emailInput, setEmailInput] = useState("");
  const [passInput, setPassInput] = useState("");

  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<{timestamp: Date, msg: string}[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tunnelStartTime = useRef<number | null>(null);
  const retryCount = useRef(0);
  const intentionalLogout = useRef(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const ip = await AsyncStorage.getItem("serverIp");
        const savedNodeId = await AsyncStorage.getItem("nodeId");
        const savedEmail = await AsyncStorage.getItem("userEmail");
        const savedName = await AsyncStorage.getItem("nodeName");
        
        if (ip && savedNodeId) {
          setServerIp(ip);
          setNodeId(savedNodeId);
          if (savedEmail) setUserEmail(savedEmail);
          if (savedName) setNodeName(savedName);
        }
      } catch { }
      setIsLoading(false);
    };

    loadSession();

    // Ouvinte Inteligente de Retorno de Internet
    const unsubscribeNet = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        if (!intentionalLogout.current && !ws.current) {
          addLog("📡 Sinal de rede restaurado. Religando túnel...");
          retryCount.current = 0;
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          connectToBroker();
        }
      } else {
        if (ws.current) {
          addLog("⚠️ Sem internet. Túnel dormente.");
        }
      }
    });

    return () => unsubscribeNet();
  }, []);

  useEffect(() => {
    // Polling de Telemetria (A cada 10 segundos varre a rede)
    const fetchNetwork = async () => {
      try {
        // Pega IP Externo Real via IPIFY
        const ipRes = await fetch("https://api.ipify.org?format=json");
        let externalIp = "N/A";
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          externalIp = ipData.ip || "N/A";
          setNetworkIp(externalIp);
        }
        
        const state = await Network.getNetworkStateAsync();
        let netType = "Desconhecida";
        if (state.type === Network.NetworkStateType.CELLULAR) netType = "4G/5G";
        else if (state.type === Network.NetworkStateType.WIFI) netType = "Wi-Fi";
        
        setNetworkType(netType);

        // Dispara telemetria ao vivo pro Motor Go (e consequentemente pra Web)
        if (ws.current?.readyState === WebSocket.OPEN) {
          let batteryLevel = 1;
          try { batteryLevel = await Battery.getBatteryLevelAsync(); } catch (e) {}
          
          let uptime = 0;
          if (tunnelStartTime.current) {
            uptime = Math.floor((Date.now() - tunnelStartTime.current) / 1000);
          }

          ws.current.send(JSON.stringify({
            type: "TELEMETRY",
            ip: externalIp,
            network: netType,
            battery: batteryLevel,
            uptime: uptime
          }));
        }
      } catch { }
    };
    
    fetchNetwork();
    const interval = setInterval(fetchNetwork, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isLoading) return;
    setIsLoading(true);
    setIsScanning(false);

    try {
      let qrToken = "";
      // Define permanentemente o servidor de produção
      const serverAddress = "api.hivenode.alfastage.com.br";

      if (data.startsWith("hivenode|")) {
        // Novo formato enxuto: hivenode|TOKEN
        const parts = data.split("|");
        qrToken = parts[1];
      } else {
        // Fallback: se ler código antigo (JSON), extrai só o token
        try {
          const parsed = JSON.parse(data);
          qrToken = parsed.qr;
        } catch {
          throw new Error("O formato deste QR Code não é reconhecido pelo HiveNode.");
        }
      }

      if (!qrToken) {
        throw new Error("Nenhum token de acesso foi encontrado neste QR Code.");
      }

      if (qrToken && serverAddress) {
        // 1. Trocar QR Token por Sessão JWT de 7 dias
        const loginRes = await fetch(getApiUrl(serverAddress, "/auth/qr-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkToken: qrToken })
        });
        const loginData = await loginRes.json();
        
        if (!loginRes.ok) throw new Error(loginData.error || "Sessão expirada. Gere outro QR Code.");
        
        const token = loginData.data.token;
        const email = loginData.data.user.email;

        // 2. Criar a Gaveta (Node) no Banco de Dados agindo como Celular
        const nodeRes = await fetch(getApiUrl(serverAddress, "/nodes"), {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ deviceName: "HiveNode Android" })
        });
        const nodeData = await nodeRes.json();

        if (!nodeRes.ok) throw new Error(nodeData.error || "Erro ao registrar o aparelho.");

        const newNodeId = nodeData.data.node.id;

        // 3. Salvar as credenciais e ligar!
        await AsyncStorage.setItem("token", token);
        await AsyncStorage.setItem("serverIp", serverAddress);
        await AsyncStorage.setItem("nodeId", newNodeId);
        await AsyncStorage.setItem("userEmail", email);
        await AsyncStorage.setItem("nodeName", "HiveNode Android");
        
        setServerIp(serverAddress);
        setNodeId(newNodeId);
        setUserEmail(email);
        setNodeName("HiveNode Android");
        Alert.alert("Sucesso", "Aparelho vinculado magicamente pelo QR Code!");
      } else {
        Alert.alert("Erro", "QR Code inválido para o HiveNode.");
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        Alert.alert("Erro na Leitura", e.message);
      } else {
        Alert.alert("Erro na Leitura", "O formato deste QR Code não é reconhecido.");
      }
    } finally {
      // Libera o carregamento no final independente de sucesso ou falha
      setIsLoading(false);
      // Opcional: Se quiser que ele volte a ler logo em seguida caso erre:
      // setIsScanning(true);
    }
  };

  const handleFocusTap = () => {
    // Desliga e liga o foco super rápido para forçar a lente a recalibrar luz/distância
    setFocusTrigger(false);
    setTimeout(() => setFocusTrigger(true), 150);
  };

  const handleLogin = async () => {
    if (!emailInput || !passInput) {
      Alert.alert("Erro", "Preencha o e-mail e a senha");
      return;
    }

    setIsLoading(true);
    try {
      const targetServer = "api.hivenode.alfastage.com.br";
      // 1. Validar e Pegar Token
      const loginRes = await fetch(getApiUrl(targetServer, "/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), password: passInput })
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(loginData.error || "Erro de autenticação");
      }

      const token = loginData.data.token;

      // 2. Registrar este Aparelho (Criar o Node no Painel)
      const nodeRes = await fetch(getApiUrl(targetServer, "/nodes"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ deviceName: "HiveNode Android" })
      });
      const nodeData = await nodeRes.json();

      if (!nodeRes.ok) {
        throw new Error(nodeData.error || "Erro ao registrar o aparelho no sistema");
      }

      const newNodeId = nodeData.data.node.id;

      // 3. Salvar tudo
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("serverIp", targetServer);
      await AsyncStorage.setItem("nodeId", newNodeId);

      setServerIp(targetServer);
      setNodeId(newNodeId);
      
    } catch (e: unknown) {
      if (e instanceof Error) {
        Alert.alert("Falha no Registro", e.message);
      } else {
        Alert.alert("Falha no Registro", "Erro desconhecido");
      }
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    intentionalLogout.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (ws.current) ws.current.close();
    try { if (notifee) await notifee.stopForegroundService(); } catch (e) {}
    await AsyncStorage.clear();
    setNodeId("");
  };

  const formatLogDate = (date: Date) => {
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (isToday) {
      return `[${timeStr}]`;
    } else {
      const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      return `[${dateStr} ${timeStr}]`;
    }
  };

  const addLog = (msg: string) => {
    // Guarda até as 100 últimas linhas de tráfego (evita Crash por Memória)
    setLogs((prev) => [{ timestamp: new Date(), msg }, ...prev].slice(0, 100));

    // Despacha o log silenciosamente para o Painel Web via Túnel (1 = OPEN)
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ type: "LOG", payload: msg }));
    }
  };

  const attemptReconnect = () => {
    if (intentionalLogout.current || isConnected || ws.current) return;
    
    const baseDelay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
    const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
    const delay = Math.floor(baseDelay + jitter);

    addLog(`⏳ Auto-Reconnect: Tentando reconectar em ${Math.round(delay/1000)}s...`);
    
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => {
      retryCount.current += 1;
      connectToBroker();
    }, delay);
  };

  const toggleConnection = async () => {
    if (isConnected || ws.current) {
      intentionalLogout.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
      setIsConnected(false);
      try {
      if (notifee) {
        await notifee.stopForegroundService();
      }
      } catch (e) {}
      return;
    }
    intentionalLogout.current = false;
    retryCount.current = 0;
    
    // Blindagem de Tela Desligada (Foreground Service)
    try {
      if (notifee) {
        await notifee.requestPermission();
        const channelId = await notifee.createChannel({
          id: 'tunnel-service',
          name: 'HiveNode Tunnel Service',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          title: 'HiveNode Ativo',
          body: 'O Túnel TCP reverso está operando em segundo plano.',
          android: {
            channelId,
            asForegroundService: true,
            color: '#f59e0b',
          },
        });
      }
    } catch (e: any) {
      addLog(`⚠️ Falha ao iniciar Serviço de Fundo: ${e.message}`);
    }

    connectToBroker();
  };

  const connectToBroker = () => {
    addLog("Conectando ao Broker no IP: " + serverIp + "...");
    const wsUrl = getWsUrl(serverIp, nodeId);
    ws.current = new WebSocket(wsUrl);
    ws.current.binaryType = "arraybuffer";

    const activeSockets: Record<string, TcpSocket.Socket> = {};

    ws.current.onopen = () => {
      tunnelStartTime.current = Date.now();
      setIsConnected(true);
      retryCount.current = 0;
      intentionalLogout.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      addLog("✅ Conectado à Rede Mestre (Aguardando Proxies)");
    };

    ws.current.onmessage = (e) => {
      // 1. Tratar Pacotes Binários (Tráfego TCP Puro)
      if (typeof e.data !== "string") {
        try {
          const buffer = new Uint8Array(e.data);
          if (buffer.length < 1) return;
          const idLen = buffer[0];
          if (buffer.length < 1 + idLen) return;
          
          const connIdBytes = buffer.slice(1, 1 + idLen);
          let connId = "";
          for (let i = 0; i < connIdBytes.length; i++) {
            connId += String.fromCharCode(connIdBytes[i]);
          }
          const payload = buffer.slice(1 + idLen);
          
          if (activeSockets[connId]) {
            activeSockets[connId].write(payload);
          }
        } catch (err: any) {
          addLog(`⚠️ Erro decodificando payload binário: ${err?.message || "Desconhecido"}`);
        }
        return;
      }

      // 2. Tratar Pacotes JSON (Controle/Handshake)
      try {
        const msg = JSON.parse(e.data);
        const { connId, type, host, newName } = msg;

        if (type === "NODE_RENAMED" && newName) {
          setNodeName(newName);
          AsyncStorage.setItem("nodeName", newName);
          return;
        }

        if (type === "DIAL") {
          addLog(`[${connId}] Requisição TCP -> ${host}`);
          
          const hostParts = host.split(":");
          const targetHost = hostParts[0];
          const targetPort = hostParts.length > 1 ? parseInt(hostParts[1], 10) : 80;

          try {
            const client = TcpSocket.createConnection({ port: targetPort, host: targetHost }, () => {
              // Confirma pro Go que o TCP abriu, liberando o SOCKS5
              ws.current?.send(JSON.stringify({ connId, type: "DIAL_OK" }));
            });

            client.on("data", (bufferData) => {
              try {
                let payloadBytes: Uint8Array;
                if (bufferData instanceof Uint8Array) {
                  payloadBytes = bufferData;
                } else if (Array.isArray(bufferData)) {
                  payloadBytes = new Uint8Array(bufferData);
                } else if (typeof bufferData === "string") {
                  const arr = new Uint8Array(bufferData.length);
                  for (let i = 0; i < bufferData.length; i++) arr[i] = bufferData.charCodeAt(i);
                  payloadBytes = arr;
                } else {
                  payloadBytes = new Uint8Array(bufferData as any);
                }

                const idBytes = new Uint8Array(connId.length);
                for (let i = 0; i < connId.length; i++) idBytes[i] = connId.charCodeAt(i);
                
                const outBuffer = new Uint8Array(1 + idBytes.length + payloadBytes.length);
                outBuffer[0] = idBytes.length;
                outBuffer.set(idBytes, 1);
                outBuffer.set(payloadBytes, 1 + idBytes.length);

                ws.current?.send(outBuffer);
              } catch (err: any) {
                addLog(`❌ [${connId}] Erro ao empacotar TCP: ${err?.message || "Desconhecido"}`);
              }
            });

            client.on("error", (error: any) => {
              addLog(`❌ [${connId}] Erro TCP: ${error?.message || "Desconhecido"}`);
              ws.current?.send(JSON.stringify({ connId, type: "DIAL_ERR" }));
            });

            client.on("close", () => {
              ws.current?.send(JSON.stringify({ connId, type: "CLOSE" }));
              delete activeSockets[connId];
            });

            activeSockets[connId] = client;
          } catch (err: any) {
            addLog(`❌ [${connId}] Falha fatal no DIAL: ${err?.message || "Desconhecido"}`);
            ws.current?.send(JSON.stringify({ connId, type: "DIAL_ERR" }));
          }
        } else if (type === "CLOSE") {
          try {
            if (activeSockets[connId]) {
              activeSockets[connId].destroy();
              delete activeSockets[connId];
            }
          } catch (e) {}
        }
      } catch (err: any) {
        addLog(`⚠️ Erro processando pacote JSON: ${err?.message || "Inválido"}`);
      }
    };

    ws.current.onerror = () => {
      addLog(`❌ Falha no WebSocket. Verifique o IP.`);
    };

    ws.current.onclose = (e) => {
      tunnelStartTime.current = null;
      setIsConnected(false);
      addLog("🛑 Túnel Desconectado");
      ws.current = null;
      Object.values(activeSockets).forEach((s: TcpSocket.Socket) => { s.destroy(); });

      if (!intentionalLogout.current) {
        attemptReconnect();
      }

      // Se o Broker informou que fomos KICKADOS (deletado pelo web panel)
      if (e.reason === "KICKED") {
        Alert.alert("Desconectado", "Este aparelho foi removido permanentemente pelo Painel Web.");
        handleLogout();
      }
    };
  };

  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  const handleRenameMobile = async () => {
    if (!editName) return;
    const finalName = editName.startsWith("HiveNode ") ? editName : `HiveNode ${editName}`;
    
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(getApiUrl(serverIp, `/nodes/${nodeId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ deviceName: finalName })
      });
      if (res.ok) {
        setNodeName(finalName);
        await AsyncStorage.setItem("nodeName", finalName);
        setIsRenameOpen(false);
      } else {
        const data = await res.json();
        Alert.alert("Erro", data.error || "Falha ao renomear aparelho.");
      }
    } catch(e) {
      Alert.alert("Erro", "Servidor inacessível. O Web Panel está ligado?");
    }
  };

  // --- TELA DE SCANNER ---
  if (isScanning) {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: 'white', marginBottom: 20, textAlign: 'center' }}>
            O HiveNode precisa da sua permissão para abrir a Câmera e ler o QR Code.
          </Text>
          <TouchableOpacity style={styles.buttonStart} onPress={requestPermission}>
            <Text style={styles.buttonText}>Conceder Permissão</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={() => setIsScanning(false)}>
            <Text style={{ color: '#8e8e99' }}>Voltar para Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <StatusBar style="light" hidden />
        <View style={styles.qrContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            autofocus={focusTrigger ? "on" : "off"}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <Pressable 
            style={StyleSheet.absoluteFillObject} 
            onPress={handleFocusTap}
          >
            <View style={styles.focusOverlay}>
              <Text style={styles.focusText}>Toque na tela para focar</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Aponte para o QR Code no seu Painel Web</Text>
          <TouchableOpacity 
            style={styles.scannerCancelBtn} 
            onPress={() => setIsScanning(false)}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Cancelar Leitura</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- TELA DE LOGIN (Sem Node/Sessão) ---
  if (!nodeId) {
    return (
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <Text style={styles.title}>Vincular Aparelho</Text>
            <Text style={styles.subtitle}>Registre este celular como um nó de rede cego.</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>E-mail (Se Cadastro Manual)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="seu@email.com" 
              placeholderTextColor="#4b4b57"
              keyboardType="email-address"
              autoCapitalize="none"
              value={emailInput}
              onChangeText={setEmailInput}
            />

            <Text style={styles.label}>Senha (Se Cadastro Manual)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Sua senha" 
              placeholderTextColor="#4b4b57"
              secureTextEntry
              value={passInput}
              onChangeText={setPassInput}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity style={[styles.buttonStart, { flex: 1 }]} onPress={handleLogin}>
                <Text style={styles.buttonText}>Fazer Login</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.buttonStart, { width: 56, backgroundColor: '#10b981', paddingHorizontal: 0 }]} 
                onPress={() => setIsScanning(true)}
              >
                <Ionicons name="qr-code-outline" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {/* Espaço em branco no final para o teclado rolar além do botão */}
            <View style={{ height: 40 }} />
          </View>
          <Text style={{ position: 'absolute', bottom: 10, right: 10, color: '#4b4b57', fontSize: 10 }}>v1.0.2</Text>
        </View>
      </ScrollView>
    );
  }

  // --- TELA PRINCIPAL (TUNNEL) ---
  return (
    <View style={styles.mainScreenContainer}>
      <StatusBar style="light" />
      
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={[styles.titleSmall, { color: '#fbbf24' }]}>HiveMiner Web3</Text>
          <Text style={styles.subtitleSmall}>Placa ID: {nodeId.split('-')[0]}</Text>
          <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: '#22c55e' }}>
             <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: 'bold' }}>NÓ PÚBLICO (RECOMPENSAS)</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Desvincular</Text>
        </TouchableOpacity>
      </View>

      {/* Gamified Points Display */}
      <View style={{ backgroundColor: "#1f2937", padding: 24, borderRadius: 20, marginBottom: 24, alignItems: "center", borderWidth: 2, borderColor: "#fbbf24" }}>
        <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>Pontos Minerados</Text>
        <Text style={{ color: "#fcd34d", fontSize: 52, fontWeight: "900", marginVertical: 8 }}>1,250</Text>
        <Text style={{ color: "#d1d5db", fontSize: 12, backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>≈ 1.25 GB Trafegados</Text>
      </View>

      <View style={[styles.infoBanner, { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }]}>
        <Text style={[styles.infoText, { color: '#fbbf24' }]}>
          Mantenha a antena ligada. A cada MB trafegado pela rede pública, você acumula $HIVE Points!
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.statusText}>
          {isConnected ? "Antena Ligada: Minerando..." : "Antena Desligada"}
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, isConnected ? styles.buttonStop : styles.buttonStart]} 
        onPress={toggleConnection}
      >
        <Text style={styles.buttonText}>
          {isConnected ? "Desligar Antena" : "Ligar Antena Web3"}
        </Text>
      </TouchableOpacity>

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Tráfego Vivo (Últimos 100 eventos):</Text>
        <ScrollView>
          {logs.map((log, index) => (
            <Text key={`${log.timestamp.getTime()}-${index}`} style={styles.logLine}>
              <Text style={styles.logTime}>{formatLogDate(log.timestamp)} </Text>
              {log.msg}
            </Text>
          ))}
        </ScrollView>
      </View>

      <Text style={{ position: 'absolute', bottom: 10, right: 10, color: '#4b4b57', fontSize: 10 }}>v1.0.0 (Miner Edition)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrContainer: {
    flex: 1,
  },
  container: {
    backgroundColor: "#0a0a0c",
    padding: 24,
    minHeight: '100%',
    paddingTop: 80, 
  },
  mainScreenContainer: {
    flex: 1,
    backgroundColor: "#0a0a0c",
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoBadge: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#f59e0b",
    fontSize: 32,
    fontWeight: "bold",
  },
  title: {
    color: "#f0f0f2",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: 'center',
  },
  subtitle: {
    color: "#8e8e99",
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    color: "#8e8e99",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#111114",
    borderWidth: 1,
    borderColor: "#27272e",
    borderRadius: 12,
    color: "#f0f0f2",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
    fontSize: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerInfo: {
    flex: 1,
  },
  titleSmall: {
    color: "#f0f0f2",
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitleSmall: {
    color: "#f59e0b",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "bold",
  },
  infoBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  infoText: {
    color: "#34d399",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111114",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#27272e",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dotOnline: {
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  dotOffline: {
    backgroundColor: "#8e8e99",
  },
  statusText: {
    color: "#f0f0f2",
    fontWeight: "500",
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  buttonStart: {
    backgroundColor: "#f59e0b",
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  buttonStop: {
    backgroundColor: "#ef4444",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    padding: 12,
    borderRadius: 12,
    alignItems: "center"
  },
  telemetryTitle: {
    color: "#8e8e99",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 4
  },
  telemetryValue: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "bold"
  },
  logsContainer: {
    backgroundColor: "#111114",
    padding: 16,
    borderRadius: 12,
    flex: 1,
    borderWidth: 1,
    borderColor: "#27272e",
  },
  logsTitle: {
    color: "#8e8e99",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  logLine: {
    color: "#f0f0f2",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 6,
  },
  logTime: {
    color: "#8e8e99",
  },
  scannerOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8
  },
  scannerCancelBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  focusOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  focusText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 20
  },
  modalContent: {
    backgroundColor: "#111114",
    borderWidth: 1,
    borderColor: "#27272e",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: "#f0f0f2",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16
  },
  modalInput: {
    backgroundColor: "#0a0a0c",
    borderWidth: 1,
    borderColor: "#27272e",
    borderRadius: 8,
    color: "white",
    padding: 12,
    fontSize: 16,
    marginBottom: 24
  },
  modalActions: {
    flexDirection: "row",
    gap: 12
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: "#1a1a20",
    padding: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  modalBtnSave: {
    flex: 1,
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  modalBtnTextCancel: {
    color: "white",
    fontWeight: "bold"
  },
  modalBtnTextSave: {
    color: "white",
    fontWeight: "bold"
  }
});
