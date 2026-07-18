// アップロード画像の保存先を切り替える (サーバー専用)。
// FIREBASE_STORAGE_BUCKET が設定されていれば Firebase Storage、なければローカル public/uploads。
// firebase-admin はローカル開発で不要なため動的importで遅延ロードする。
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { uploadFilenameFromUrl } from "@/lib/backup-images";

export function usingCloudStorage(): boolean {
  return Boolean(process.env.FIREBASE_STORAGE_BUCKET);
}

// 保存して公開URL (またはローカル相対パス) を返す
export async function saveUpload(
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    // ローカル開発: public/uploads に保存
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
    return `/uploads/${filename}`;
  }

  // 本番: Firebase Storage にアップロードして公開URLを返す。
  // App Hosting/Cloud Run 上ではサービスアカウントで自動認証される (ADC)。
  const { getApps, initializeApp, applicationDefault } = await import(
    "firebase-admin/app"
  );
  const { getStorage } = await import("firebase-admin/storage");
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      storageBucket: bucketName,
    });
  }
  const objectPath = `uploads/${filename}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  await file.save(bytes, { contentType, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

// imageUrl から画像バイト列を読み出す (バックアップの画像同梱用)。
// ローカルパスは public/uploads から、https:// は公開URLをそのままfetchする。
// 見つからない・読めない場合は null (呼び出し側でスキップ扱い)。
export async function readUpload(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("/uploads/")) {
      const filename = uploadFilenameFromUrl(url);
      if (!filename) return null;
      return await readFile(path.join(process.cwd(), "public", "uploads", filename));
    }
    if (url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}
