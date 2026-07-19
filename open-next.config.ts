import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 全ページを動的レンダリングで運用するため、ISR/SSGキャッシュの追加設定は不要。
export default defineCloudflareConfig();
