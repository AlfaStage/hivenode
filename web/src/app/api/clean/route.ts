import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const result = await prisma.node.deleteMany({
    where: { deviceModel: "App Android (QR Code)" }
  });
  return apiSuccess({ deleted: result.count });
}
