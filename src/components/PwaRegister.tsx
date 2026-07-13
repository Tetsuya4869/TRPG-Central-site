"use client";

// service worker を登録する (対応ブラウザのみ)。UIは描画しない。
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // 本番のみ登録 (dev では next のHMRと競合しうるため避ける)
    if (process.env.NODE_ENV !== "production") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 登録失敗は致命的でないため握りつぶす
      });
    };
    // useEffectはhydration後に走るため load を取り逃すことがある。
    // 既に読み込み済みなら即登録、そうでなければ load を待つ。
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
