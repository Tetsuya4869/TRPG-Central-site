// バックアップv3の画像同梱まわりの純関数 (fs非依存、テスト対象)。
// 画像は { imageUrl文字列 → {contentType, base64} } のマップとしてJSONに埋め込む。
import { isAllowedImageUrl } from "@/lib/upload";

// base64化する画像の合計 (raw) 上限。base64で約1.33倍になり、インポート上限200MBに収まる値
export const MAX_EMBED_TOTAL = 100 * 1024 * 1024;

export interface BackupImageEntry {
  contentType: string;
  base64: string;
}

// 画像URL列を持つ行グループから、埋め込み対象のURLを重複なしで集める
export function collectImageUrls(
  ...groups: { imageUrl?: string | null }[][]
): string[] {
  const urls = new Set<string>();
  for (const group of groups) {
    for (const row of group) {
      const url = row.imageUrl;
      if (url && isAllowedImageUrl(url)) urls.add(url);
    }
  }
  return [...urls];
}

// imageUrl から uploads のファイル名を取り出す。
// 対応: "/uploads/<name>" / "https://storage.googleapis.com/<bucket>/uploads/<name>"
//      / "https://firebasestorage.googleapis.com/…/uploads/<name>"
// トラバーサルやサブディレクトリ・不審な拡張子は null (復元時に無視される)
const SAFE_FILENAME = /^[0-9a-zA-Z_-]+\.(png|jpe?g|webp|gif)$/;

export function uploadFilenameFromUrl(url: string): string | null {
  let filename: string | null = null;
  if (url.startsWith("/uploads/")) {
    filename = url.slice("/uploads/".length);
  } else {
    const marker = "/uploads/";
    const idx = url.indexOf(marker);
    if (url.startsWith("https://") && idx >= 0) {
      filename = url.slice(idx + marker.length);
    }
  }
  if (!filename || !SAFE_FILENAME.test(filename)) return null;
  return filename;
}

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function contentTypeForFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXT_TO_MIME[ext]) || null;
}

// マジックバイト検査 (uploads APIと同じ形式サポート: png/jpeg/webp/gif)
export function matchesImageMagic(contentType: string, bytes: Uint8Array): boolean {
  switch (contentType) {
    case "image/png": {
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return sig.every((b, i) => bytes[i] === b);
    }
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
      );
    case "image/gif": {
      const header = String.fromCharCode(...bytes.subarray(0, 6));
      return header === "GIF87a" || header === "GIF89a";
    }
    default:
      return false;
  }
}
