import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromAddress = process.env.SMTP_FROM || 'HiveNode<hivenode@alfastage.com.br>';

export async function sendWelcomeEmail(to: string, role: string) {
  const isMiner = role !== 'ADMIN';
  const color = isMiner ? '#10b981' : '#fbbf24'; // Verde Neon ou Laranja
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #333;">
      <h2 style="color: ${color}; text-align: center;">Bem-vindo ao HiveNode! 🐝</h2>
      <p style="font-size: 16px;">Olá,</p>
      <p style="font-size: 16px;">Sua conta foi criada com sucesso no sistema HiveNode. Estamos muito felizes em ter você conosco.</p>
      <p style="font-size: 16px;">Acesse seu painel para começar a interagir com os seus recursos.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://hivenode.alfastage.com.br/login" style="background-color: ${color}; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">Acessar Painel</a>
      </div>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) return; // Skip if not configured
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Bem-vindo ao HiveNode! 🐝',
      html,
    });
    console.log(`[Email] Bem-vindo enviado para ${to}`);
  } catch (error) {
    console.error(`[Email Error] Falha ao enviar welcome para ${to}`, error);
  }
}

export async function sendNodeAlert(to: string, deviceName: string, visibility: string) {
  const color = visibility === 'PUBLIC' ? '#10b981' : '#fbbf24';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #333;">
      <h2 style="color: ${color}; text-align: center;">Novo Node Conectado 🌐</h2>
      <p style="font-size: 16px;">Olá,</p>
      <p style="font-size: 16px;">Um novo Node <strong>${deviceName}</strong> foi registrado com sucesso em sua conta.</p>
      <p style="font-size: 16px;">Visibilidade: <strong>${visibility}</strong></p>
      <p style="font-size: 16px;">Mantenha seu node online para garantir a máxima performance da rede e suas recompensas.</p>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) return;
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Novo Node Registrado no HiveNode',
      html,
    });
    console.log(`[Email] Node alert enviado para ${to}`);
  } catch (error) {
    console.error(`[Email Error] Falha ao enviar node alert para ${to}`, error);
  }
}

export async function sendProxyAlert(to: string, proxyUser: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #333;">
      <h2 style="color: #fbbf24; text-align: center;">Credencial Proxy Gerada 🚀</h2>
      <p style="font-size: 16px;">Olá,</p>
      <p style="font-size: 16px;">Uma nova credencial de proxy SOCKS5 foi gerada e vinculada à sua conta.</p>
      <p style="font-size: 16px; background-color: #1a1a1a; padding: 10px; border-radius: 4px; font-family: monospace;">
        Usuário: ${proxyUser}
      </p>
      <p style="font-size: 16px;">Você já pode utilizar essa credencial no broker.</p>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) return;
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Nova Credencial SOCKS5 Gerada',
      html,
    });
    console.log(`[Email] Proxy alert enviado para ${to}`);
  } catch (error) {
    console.error(`[Email Error] Falha ao enviar proxy alert para ${to}`, error);
  }
}

export async function sendAdminErrorAlert(errorMessage: string) {
  const adminEmail = process.env.ADMIN_EMAIL_ALERTS || 'hivenode@alfastage.com.br';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a0000; color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ff3333;">
      <h2 style="color: #ff4444; text-align: center;">⚠️ ALERTA CRÍTICO DE SISTEMA ⚠️</h2>
      <p style="font-size: 16px;">Um erro crítico interno (Status 500) foi interceptado no sistema.</p>
      <div style="background-color: #330000; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <pre style="color: #ff9999; margin: 0; white-space: pre-wrap;">${errorMessage}</pre>
      </div>
      <p style="font-size: 14px; color: #aaa; margin-top: 20px;">Este é um alerta automático do backend HiveNode.</p>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) return;
    await transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: '⚠️ Alerta Crítico - HiveNode Backend',
      html,
    });
    console.log(`[Email] Admin Error alert enviado para ${adminEmail}`);
  } catch (error) {
    console.error(`[Email Error] Falha ao enviar admin alert para ${adminEmail}`, error);
  }
}
