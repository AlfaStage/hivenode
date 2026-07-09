const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.node.deleteMany({ where: { deviceModel: 'App Android (QR Code)' } })
  .then(res => console.log('Zumbis Apagados: ', res.count))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
