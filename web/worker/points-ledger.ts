import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

async function processTrafficLogs() {
  const BATCH_SIZE = 100;
  
  try {
    const logs = await redis.lPopCount('traffic_logs', BATCH_SIZE);
    
    if (!logs || logs.length === 0) return;
    
    console.log(`[Worker] Processando ${logs.length} logs de tráfego...`);
    
    // Agrupar por nodeID para minimizar transações
    const trafficByNode: Record<string, { tx: number, rx: number }> = {};
    
    for (const log of logs) {
      // Formato: "nodeID:tx:rx"
      const [nodeId, txStr, rxStr] = log.split(':');
      const tx = parseInt(txStr, 10);
      const rx = parseInt(rxStr, 10);
      
      if (!trafficByNode[nodeId]) {
        trafficByNode[nodeId] = { tx: 0, rx: 0 };
      }
      trafficByNode[nodeId].tx += tx;
      trafficByNode[nodeId].rx += rx;
    }
    
    // Processar pontuação em transação
    await prisma.$transaction(async (tx) => {
      for (const [nodeId, traffic] = Object.entries(trafficByNode)) {
        // Encontrar usuário do Node
        const node = await tx.node.findUnique({
          where: { id: nodeId },
          select: { userId: true, visibility: true }
        });
        
        if (!node || !node.userId || node.visibility !== 'PUBLIC') continue;
        
        // Exemplo: 500 pontos por GB traficado (Tx + Rx)
        const totalBytes = traffic.tx + traffic.rx;
        const gb = totalBytes / (1024 * 1024 * 1024);
        const points = gb * 500;
        
        if (points <= 0) continue;
        
        await tx.pointsLedger.create({
          data: {
            userId: node.userId,
            amount: points,
            type: 'TRAFFIC'
          }
        });
        
        await tx.user.update({
          where: { id: node.userId },
          data: { hivePoints: { increment: points } }
        });
      }
    });
    
    console.log(`[Worker] Lote de pontuação de tráfego concluído.`);
    
  } catch (error) {
    console.error('[Worker] Erro ao processar traffic_logs:', error);
  }
}

async function startWorker() {
  await redis.connect();
  console.log('🐝 HiveNode Points Worker iniciado. Escutando Redis...');
  
  // Rodar a cada 5 minutos
  setInterval(processTrafficLogs, 5 * 60 * 1000);
}

startWorker();
