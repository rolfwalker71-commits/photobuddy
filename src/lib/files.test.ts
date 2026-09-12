import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePhotoPath } from "@/lib/files";

describe("resolvePhotoPath", () => {
  beforeEach(() => {
    vi.stubEnv("PHOTOS_DIR", "/data/photos");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves paths inside the photo volume", () => {
    expect(resolvePhotoPath("user-1/abc.jpg")).toBe("/data/photos/user-1/abc.jpg");
    expect(resolvePhotoPath("/user-1/thumbs/abc.jpg")).toBe(
      "/data/photos/user-1/thumbs/abc.jpg",
    );
    expect(resolvePhotoPath("user-1\\abc.jpg")).toBe("/data/photos/user-1/abc.jpg");
  });

  it.each([
    "../etc/passwd",
    "user-1/../../etc/passwd",
    "..",
    "user-1/\0.jpg",
    "",
    "/",
  ])("refuses %j", (path) => {
    expect(() => resolvePhotoPath(path)).toThrow("Ungültiger Dateipfad.");
  });

  it("does not treat a sibling directory with the same prefix as inside", () => {
    expect(() => resolvePhotoPath("../photos-evil/x.jpg")).toThrow();
  });
});
