import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: true
  }
};

export default nextConfig;
