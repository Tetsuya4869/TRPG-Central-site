// 単一パスワードのログインゲート用のセッション。
// APP_PASSWORD が設定されている場合のみ認証が有効になる (未設定=ローカル開発で素通し)。
// セッションは AUTH_SECRET で署名したJWTをhttpOnly Cookieに保存する (Edge/middleware対応のため jose を使用)。
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "trpg_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30日

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET が設定されていません");
  return new TextEncoder().encode(s);
}

// 認証が有効か (APP_PASSWORD 未設定ならローカル開発とみなし無効)
export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export async function createSessionToken(): Promise<string> {
  return await new SignJWT({ authed: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.authed === true;
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SEC;
