import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cloudflare D1バインディングからPrismaClientを生成する。
// バインディングは通常同一isolate内で不変だが、念のためenvの同一性を確認し、
// 変わっていた場合は作り直す。
let cached: PrismaClient | undefined;
let cachedEnv: unknown;

function getClient(): PrismaClient {
  const { env } = getCloudflareContext();
  if (!cached || cachedEnv !== env) {
    cachedEnv = env;
    cached = new PrismaClient({ adapter: new PrismaD1(env.DB) });
  }
  return cached;
}

// 既存コードの `prisma.character.findMany()` などの呼び出し形を変えないための遅延Proxy。
// モジュール読込時(=ビルド時)にはD1に触れず、最初のプロパティアクセス時に実体化する。
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
