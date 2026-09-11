import { describe, expect, it } from "vitest";
import { emptyFilters, filterPhotos } from "@/lib/filters";
import { isPhotoNew } from "@/lib/last-seen";
import type { Photo } from "@/lib/types";

const photo = (id: string, uploaded_by: string, created_at: string) =>
  ({ id, uploaded_by, created_at, taken_at: null, is_highlight: false }) as Photo;

const lastSeen = "2026-09-10T20:00:00.000Z";
const photos = [
  photo("old", "ben", "2026-09-10T18:00:00.000Z"),
  photo("new-ben", "ben", "2026-09-11T09:00:00.000Z"),
  photo("new-anna", "anna", "2026-09-11T10:00:00.000Z"),
];

describe("new since last visit", () => {
  it("counts photos created after the last visit", () => {
    expect(photos.filter((p) => isPhotoNew(p, lastSeen)).map((p) => p.id)).toEqual([
      "new-ben",
      "new-anna",
    ]);
  });

  it("never counts your own uploads", () => {
    expect(photos.filter((p) => isPhotoNew(p, lastSeen, "anna")).map((p) => p.id)).toEqual([
      "new-ben",
    ]);
  });

  it("shows nothing as new on a first visit", () => {
    expect(photos.some((p) => isPhotoNew(p, null))).toBe(false);
  });

  it("applies the same rule in the Neu filter", () => {
    const visible = filterPhotos(
      photos,
      { ...emptyFilters, onlyNew: true },
      { lastSeenAt: lastSeen, viewerId: "anna" },
    );
    expect(visible.map((p) => p.id)).toEqual(["new-ben"]);
  });
});
