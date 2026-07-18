import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { LogoutButton } from "@/components/LogoutButton";
import { CommandPalette } from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "TRPG Central",
  description: "クトゥルフ神話TRPGをはじめとするTRPGの管理サイト",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TRPG Central" },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

// Next 16 は themeColor を viewport に置く
export const viewport: Viewport = {
  themeColor: "#059669",
};

const navItems = [
  { href: "/characters", label: "探索者" },
  { href: "/sessions", label: "卓管理" },
  { href: "/scenarios", label: "シナリオ" },
  { href: "/dice", label: "ダイス" },
  { href: "/ai-gm", label: "AI GM" },
  { href: "/reference", label: "早見表" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <PwaRegister />
        <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 min-h-14 py-2 flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link
              href="/"
              className="font-bold text-emerald-400 tracking-wide whitespace-nowrap"
            >
              TRPG Central
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-zinc-300 hover:text-emerald-300 transition-colors whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
              {/* 静的HTML (public/manual.html) なので Link ではなく a で遷移する */}
              <a
                href="/manual.html"
                className="text-zinc-300 hover:text-emerald-300 transition-colors whitespace-nowrap"
              >
                説明書
              </a>
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <CommandPalette />
              {process.env.APP_PASSWORD && (
                <div className="text-sm">
                  <LogoutButton />
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 flex-1">
          {children}
        </main>
        <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
          TRPG Central — クトゥルフ神話TRPG(6版/7版)対応 管理サイト
        </footer>
      </body>
    </html>
  );
}
