"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-zinc-500 hover:text-emerald-300 transition-colors whitespace-nowrap"
    >
      ログアウト
    </button>
  );
}
