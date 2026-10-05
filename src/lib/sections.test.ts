import { describe, expect, it } from "vitest";
import { sectionColorVar, sectionForPath } from "@/lib/sections";

describe("sectionForPath", () => {
  it("maps main sections", () => {
    expect(sectionForPath("/gallery")).toBe("gallery");
    expect(sectionForPath("/map")).toBe("map");
    expect(sectionForPath("/gallery/share/abc/map")).toBe("map");
    expect(sectionForPath("/timeline")).toBe("timeline");
    expect(sectionForPath("/camera")).toBe("camera");
    expect(sectionForPath("/settings/help")).toBe("more");
  });

  it("falls back to gallery", () => {
    expect(sectionForPath("/photos/1")).toBe("gallery");
    expect(sectionForPath("/recap")).toBe("gallery");
  });

  it("builds the css variable name", () => {
    expect(sectionColorVar("map")).toBe("--section-map");
  });
});
