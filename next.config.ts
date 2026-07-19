import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// `next dev` でも getCloudflareContext() からローカルのD1/R2バインディング(miniflare)を
// 使えるようにする。本番ビルドには影響しない。
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Prismaクライアントはバンドルせず外部化し、OpenNextがWorkers(workerd)用に
  // パッチを当てられるようにする (OpenNext公式のPrisma+D1手順)
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
