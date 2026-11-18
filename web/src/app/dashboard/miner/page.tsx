import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import MinerDashboard from "./miner-dashboard";

export default async function MinerPage() {
  const user = await getAuthenticatedUser();
  if (!user?.minerBetaAccess) notFound();

  return <MinerDashboard apkUrl="https://expo.dev/artifacts/eas/idNUBIBrLxPhFC9l5nLiEAVBuDdJfBTc6HZRSBgtu2A.apk" />;
}
