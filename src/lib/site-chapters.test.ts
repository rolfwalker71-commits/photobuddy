import { describe, expect, it } from "vitest";
import { chapterAt, isSiteChapter, type SiteChapter } from "@/lib/site-chapters";

const chapter = (schluessel: string, von: string, bis: string): SiteChapter => ({
  schluessel,
  nummer: 0,
  titel: schluessel,
  farbe: "ozean",
  von,
  bis,
});

const trip = [
  chapter("anreise", "2026-10-23T07:00", "2026-10-25T17:00"),
  chapter("atlantik", "2026-10-25T17:00", "2026-11-07T09:30"),
  chapter("karibik", "2026-11-08T16:00", "2026-11-15T10:00"),
];

describe("chapterAt", () => {
  it("finds the chapter a photo was taken in", () => {
    expect(chapterAt(trip, "2026-11-10T14:30")?.schluessel).toBe("karibik");
  });

  it("prefers the later chapter at a shared boundary", () => {
    expect(chapterAt(trip, "2026-10-25T17:00")?.schluessel).toBe("atlantik");
  });

  it("uses the last started chapter in a gap", () => {
    expect(chapterAt(trip, "2026-11-08T08:00")?.schluessel).toBe("atlantik");
  });

  it("uses the first chapter before the trip and the last after it", () => {
    expect(chapterAt(trip, "2026-09-15T17:00")?.schluessel).toBe("anreise");
    expect(chapterAt(trip, "2026-12-01T09:00")?.schluessel).toBe("karibik");
  });

  it("returns nothing without chapters or time", () => {
    expect(chapterAt([], "2026-11-10T14:30")).toBeNull();
    expect(chapterAt(trip, "")).toBeNull();
  });
});

describe("isSiteChapter", () => {
  it("accepts chapters and rejects junk", () => {
    expect(isSiteChapter(trip[0])).toBe(true);
    expect(isSiteChapter({ titel: "ohne Schlüssel" })).toBe(false);
    expect(isSiteChapter(null)).toBe(false);
  });
});
