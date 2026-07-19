// getCloudflareContext() が返す env の型定義。
// wrangler.jsonc のバインディングを追加・変更したらここも合わせて更新する。
import type { D1Database, Fetcher, R2Bucket } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    /** D1データベース (Prisma driver adapter経由で使用) */
    DB: D1Database;
    /** 立ち絵画像の保存先R2バケット */
    UPLOADS: R2Bucket;
    /** 静的アセット */
    ASSETS: Fetcher;
    /** AI GM機能用 (未設定ならAI機能は503を返す) */
    ANTHROPIC_API_KEY?: string;
  }
}

export {};
