// 画像URLの検証 (クライアント/サーバー共用、firebase-admin非依存)。
// ローカル保存(/uploads/…) と Firebase Storage の公開URL のみ許可し、javascript: 等を弾く。
import { z } from "zod";

const ALLOWED_IMAGE_HOSTS = [
  "https://storage.googleapis.com/",
  "https://firebasestorage.googleapis.com/",
];

export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith("/uploads/")) return true;
  return ALLOWED_IMAGE_HOSTS.some((h) => url.startsWith(h));
}

export const imageUrlSchema = z
  .string()
  .max(500)
  .refine(isAllowedImageUrl, "画像URLが不正です");
