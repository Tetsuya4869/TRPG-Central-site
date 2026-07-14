import { describe, it, expect } from "vitest";
import { isAllowedImageUrl, imageUrlSchema } from "./upload";

describe("isAllowedImageUrl", () => {
  it("ローカルの /uploads/ を許可", () => {
    expect(isAllowedImageUrl("/uploads/abc.png")).toBe(true);
  });
  it("Firebase Storage の公開URLを許可", () => {
    expect(
      isAllowedImageUrl("https://storage.googleapis.com/my-bucket/uploads/x.png"),
    ).toBe(true);
    expect(
      isAllowedImageUrl("https://firebasestorage.googleapis.com/v0/b/x/o/y.png"),
    ).toBe(true);
  });
  it("javascript: や外部URLを拒否", () => {
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl("https://evil.example.com/x.png")).toBe(false);
    expect(isAllowedImageUrl("http://storage.googleapis.com/x")).toBe(false); // httpsのみ
    expect(isAllowedImageUrl("../../etc/passwd")).toBe(false);
  });
  it("imageUrlSchema が同じ検証を行う", () => {
    expect(imageUrlSchema.safeParse("/uploads/x.png").success).toBe(true);
    expect(imageUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});
