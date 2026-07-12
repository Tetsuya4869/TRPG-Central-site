import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRPG Central",
  description: "クトゥルフ神話TRPGをはじめとするTRPGの管理サイト",
};

const navItems = [
  { href: "/characters", label: "探索者" },
  { href: "/sessions", label: "卓管理" },
  { href: "/scenarios", label: "シナリオ" },
  { href: "/dice", label: "ダイス" },
  { href: "/ai-gm", label: "AI GM" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
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
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 flex-1">
          {children}
        </main>
        <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
          TRPG Central — クトゥルフ神話TRPG(6版)対応 管理サイト
        </footer>
      </body>
    </html>
  );
}
