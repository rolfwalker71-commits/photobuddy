import { describe, expect, it } from "vitest";
import { albumStats, pluralize } from "@/lib/album-stats";
import type { Photo } from "@/lib/types";

function photo(taken_at: string, kind: "photo" | "video" = "photo") {
  return { taken_at, created_at: taken_at, kind } as Photo;
}

describe("albumStats", () => {
  it("counts photos, videos and distinct days", () => {
    const stats = albumStats([
      photo("2026-09-12T10:00:00", "photo"),
      photo("2026-09-12T18:00:00", "video"),
      photo("2026-09-14T09:00:00", "photo"),
    ]);
    expect(stats).toMatchObject({
      photos: 2,
      videos: 1,
      days: 2,
      firstDay: "2026-09-12",
      lastDay: "2026-09-14",
    });
  });

  it("handles an empty album", () => {
    expect(albumStats([])).toEqual({
      photos: 0,
      videos: 0,
      days: 0,
      firstDay: null,
      lastDay: null,
    });
  });
});

describe("pluralize", () => {
  it("picks singular and plural", () => {
    expect(pluralize(1, "Tag", "Tage")).toBe("1 Tag");
    expect(pluralize(3, "Tag", "Tage")).toBe("3 Tage");
  });
});
