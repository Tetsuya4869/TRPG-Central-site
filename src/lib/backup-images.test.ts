import { describe, it, expect } from "vitest";
import {
  collectImageUrls,
  uploadFilenameFromUrl,
  contentTypeForFilename,
  matchesImageMagic,
} from "./backup-images";

describe("collectImageUrls", () => {
  it("複数グループから重複なしで集め、null・不正URLを除く", () => {
    const urls = collectImageUrls(
      [
        { imageUrl: "/uploads/a.png" },
        { imageUrl: null },
        { imageUrl: "/uploads/a.png" },
        { imageUrl: "javascript:alert(1)" },
      ],
      [
        { imageUrl: "https://storage.googleapis.com/bkt/uploads/b.jpg" },
        {},
      ],
    );
    expect(urls).toEqual([
      "/uploads/a.png",
      "https://storage.googleapis.com/bkt/uploads/b.jpg",
    ]);
  });
});

describe("uploadFilenameFromUrl", () => {
  it("ローカルパスとFirebase公開URLからファイル名を取り出す", () => {
    expect(uploadFilenameFromUrl("/uploads/abc-123.png")).toBe("abc-123.png");
    expect(
      uploadFilenameFromUrl("https://storage.googleapis.com/bkt/uploads/x.webp"),
    ).toBe("x.webp");
  });

  it("トラバーサル・サブディレクトリ・不正拡張子はnull", () => {
    expect(uploadFilenameFromUrl("/uploads/../secret.png")).toBeNull();
    expect(uploadFilenameFromUrl("/uploads/dir/a.png")).toBeNull();
    expect(uploadFilenameFromUrl("/uploads/a.svg")).toBeNull();
    expect(uploadFilenameFromUrl("/uploads/")).toBeNull();
    expect(uploadFilenameFromUrl("http://storage.googleapis.com/bkt/uploads/a.png")).toBeNull(); // httpsのみ
    expect(uploadFilenameFromUrl("/etc/passwd")).toBeNull();
  });
});

describe("contentTypeForFilename", () => {
  it("拡張子からMIMEを引く (未知はnull)", () => {
    expect(contentTypeForFilename("a.png")).toBe("image/png");
    expect(contentTypeForFilename("a.JPG".toLowerCase())).toBe("image/jpeg");
    expect(contentTypeForFilename("a.jpeg")).toBe("image/jpeg");
    expect(contentTypeForFilename("a.webp")).toBe("image/webp");
    expect(contentTypeForFilename("a.gif")).toBe("image/gif");
    expect(contentTypeForFilename("a.svg")).toBeNull();
  });
});

describe("matchesImageMagic", () => {
  it("4形式のマジックバイトを検査し、偽装を弾く", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const gif = new Uint8Array([...Array.from("GIF89a").map((c) => c.charCodeAt(0)), 0]);
    const webp = new Uint8Array([
      ...Array.from("RIFF").map((c) => c.charCodeAt(0)),
      0, 0, 0, 0,
      ...Array.from("WEBP").map((c) => c.charCodeAt(0)),
    ]);
    expect(matchesImageMagic("image/png", png)).toBe(true);
    expect(matchesImageMagic("image/jpeg", jpg)).toBe(true);
    expect(matchesImageMagic("image/gif", gif)).toBe(true);
    expect(matchesImageMagic("image/webp", webp)).toBe(true);
    // 中身がPNGなのにjpeg申告 → 拒否
    expect(matchesImageMagic("image/jpeg", png)).toBe(false);
    expect(matchesImageMagic("image/svg+xml", png)).toBe(false);
  });
});
