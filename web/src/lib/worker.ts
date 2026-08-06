// ==============================================================================
// Background Jobs — BullMQ Worker Setup
// ==============================================================================
// Este worker processa o consumo de banda (Tráfego) reportado pelo Broker.
// ==============================================================================

import { Worker, type Job } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";

interface BillingJobData {
  nodeId: string;
  bytesUsed: number;
}

export const billingQueueName = "billing-queue";

const worker = new Worker<BillingJobData>(
  billingQueueName,
  async (job: Job<BillingJobData>) => {
    const { nodeId, bytesUsed } = job.data;

    // Converte bytes para GB
    const gbUsed = bytesUsed / (1024 * 1024 * 1024);

    // Encontra o dono do Node
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { userId: true },
    });

    if (!node || !node.userId) {
      console.warn(`[BullMQ] Node ${nodeId} não encontrado ou sem dono.`);
      return;
    }

    // Deduz o saldo do usuário
    const user = await prisma.user.update({
      where: { id: node.userId },
      data: {
        balanceGB: { decrement: gbUsed },
      },
      select: { balanceGB: true, email: true },
    });

    // Se o saldo ficar negativo, suspende os nodes (O Broker verificará isso)
    if (user.balanceGB <= 0) {
      console.log(`[BullMQ] ⚠️ Saldo esgotado para o usuário ${user.email}.`);
      await prisma.node.updateMany({
        where: { userId: node.userId },
        data: { status: "BLOCKED" },
      });
      
      // TODO: Notificar o Broker via Pub/Sub para desconectar os WS ativos
      await redis.publish("broker:disconnect", JSON.stringify({ userId: node.userId }));
    } else {
      console.log(`[BullMQ] ✅ Debitado ${gbUsed.toFixed(4)} GB do usuário ${user.email}. Saldo restante: ${user.balanceGB.toFixed(2)} GB.`);
    }

    // Atualiza estatísticas do Proxy
    await prisma.proxyCredential.updateMany({
      where: { nodeId: nodeId },
      data: {
        totalBytesTx: { increment: BigInt(bytesUsed) },
      },
    });
  },
  { connection: redis as unknown as import('bullmq').ConnectionOptions }
);

worker.on("failed", (job, err) => {
  console.error(`[BullMQ] Job ${job?.id} falhou com erro: ${err.message}`);
});

import { sendAdminErrorAlert } from "./email";

const errorWorker = new Worker(
  "error-alerts",
  async (job: Job<{ message: string }>) => {
    await sendAdminErrorAlert(`API Erro Crítico (500): ${job.data.message}`);
  },
  { connection: redis as unknown as import('bullmq').ConnectionOptions }
);

errorWorker.on("failed", (job, err) => {
  console.error(`[BullMQ] Error Alert Job ${job?.id} falhou com erro: ${err.message}`);
});

const subscriptionWorker = new Worker(
  "subscription-check",
  async () => {
    const now = new Date();
    
    // Find expired subscriptions that are still active
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lt: now }
      },
      select: { id: true, userId: true }
    });

    if (expiredSubs.length > 0) {
      console.log(`[BullMQ] Encontradas ${expiredSubs.length} assinaturas vencidas. Processando bloqueio...`);
      
      for (const sub of expiredSubs) {
        // Update subscription status
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" }
        });

        // Block all nodes
        await prisma.node.updateMany({
          where: { userId: sub.userId },
          data: { status: "BLOCKED" }
        });

        // Emit disconnect to broker for this user
        await redis.publish("broker:disconnect", JSON.stringify({ userId: sub.userId }));
        
        console.log(`[BullMQ] Assinatura ${sub.id} vencida. Usuário ${sub.userId} bloqueado.`);
      }
    }
  },
  { connection: redis as unknown as import('bullmq').ConnectionOptions }
);

subscriptionWorker.on("failed", (job, err) => {
  console.error(`[BullMQ] Subscription Check Job falhou com erro: ${err.message}`);
});

import { Queue } from "bullmq";
const subscriptionQueue = new Queue("subscription-check", { connection: redis as unknown as import('bullmq').ConnectionOptions });

// Enfileira o job de checagem a cada 5 minutos
subscriptionQueue.add("check-expired-subs", {}, {
  repeat: {
    every: 5 * 60 * 1000
  },
  removeOnComplete: true,
  removeOnFail: true,
}).catch(console.error);

export { worker, errorWorker, subscriptionWorker, subscriptionQueue };
