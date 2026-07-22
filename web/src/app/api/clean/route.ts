import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // ⚠️ ALERTA DE PERDA DE DADOS: DELETA TODAS AS TABELAS
    await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO hivenode_user; GRANT ALL ON SCHEMA public TO public;');
    return apiSuccess({ message: "Banco de dados limpo com sucesso. Reinicie a aplicação para o Prisma recriar as tabelas." });
  } catch (error) {
    console.error("Erro ao limpar banco:", error);
    return Response.json({ error: "Erro ao limpar banco" }, { status: 500 });
  }
}
