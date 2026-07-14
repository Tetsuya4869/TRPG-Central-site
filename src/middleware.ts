// 全ページ・全APIをログインゲートで保護する。
// APP_PASSWORD 未設定なら認証無効 (ローカル開発)。ログイン画面・認証API・PWA資産は常に許可。
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, authEnabled } from "@/lib/auth";

// 認証なしで到達できるパス
const PUBLIC_PATHS = new Set([
  "/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/favicon.ico",
]);
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/icon-", "/apple-touch-icon"];

export async function middleware(req: NextRequest) {
  // 認証が無効ならすべて素通し
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  // 未認証: APIは401、ページはログインへリダイレクト
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 静的最適化アセット以外の全リクエストで実行 (細かい許可は上のコードで行う)
  matcher: ["/((?!_next/static|_next/image).*)"],
};
