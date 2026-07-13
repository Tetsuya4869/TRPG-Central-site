import type { MetadataRoute } from "next";

// PWAマニフェスト (Next metadataルート → /manifest.webmanifest)。
// ホーム画面追加・スタンドアロン表示に対応する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRPG Central",
    short_name: "TRPG Central",
    description: "クトゥルフ神話TRPG(6版/7版)対応の管理サイト。AI GMプレイ対応。",
    lang: "ja",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b", // zinc-950
    theme_color: "#059669", // emerald-600
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
