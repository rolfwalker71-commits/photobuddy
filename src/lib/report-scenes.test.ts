import { describe, expect, it } from "vitest";
import { groupScenes, pickVisionIds, type ReportScene } from "@/lib/report-scenes";
import type { Photo } from "@/lib/types";

const ph = (id: string, taken: string, place: string | null = null) =>
  ({ id, taken_at: taken, created_at: taken, location_name: place, kind: "photo" }) as unknown as Photo;

describe("groupScenes", () => {
  it("splits on gaps above 3 h", () => {
    const scenes = groupScenes([
      ph("a", "2026-10-23T08:00:00Z"),
      ph("b", "2026-10-23T10:59:00Z"),
      ph("c", "2026-10-23T14:00:00Z"),
    ]);
    expect(scenes.map((s) => s.photoIds)).toEqual([["a", "b"], ["c"]]);
  });
  it("splits when the place changes, but not for a missing place", () => {
    const scenes = groupScenes([
      ph("a", "2026-10-23T08:00:00Z", "Zürich"),
      ph("b", "2026-10-23T08:05:00Z"),
      ph("c", "2026-10-23T08:10:00Z", "Barcelona"),
    ]);
    expect(scenes.map((s) => [s.place, s.photoIds])).toEqual([
      ["Zürich", ["a", "b"]],
      ["Barcelona", ["c"]],
    ]);
  });
  it("collects people and stamps in Zurich time", () => {
    const [scene] = groupScenes(
      [ph("a", "2026-10-23T08:00:00Z"), ph("b", "2026-10-23T08:30:00Z")],
      (id) => (id === "a" ? ["Anna", "Tom"] : ["Tom", "Lea"]),
    );
    expect(scene.people).toEqual(["Anna", "Tom", "Lea"]);
    expect(scene.from).toBe("2026-10-23T10:00");
    expect(scene.to).toBe("2026-10-23T10:30");
  });
  it("handles an empty series", () => {
    expect(groupScenes([])).toEqual([]);
  });
});

describe("pickVisionIds", () => {
  const scene = (ids: string[]): ReportScene => ({ from: "", to: "", place: null, photoIds: ids, people: [] });
  it("takes the first photo of every scene first", () => {
    const ids = pickVisionIds([scene(["a1", "a2", "a3"]), scene(["b1"]), scene(["c1", "c2"])], 3);
    expect(ids).toEqual(["a1", "b1", "c1"]);
  });
  it("spreads the rest over the scenes, at most max", () => {
    const big = scene(Array.from({ length: 20 }, (_, i) => `a${i}`));
    const small = scene(["b0", "b1"]);
    const ids = pickVisionIds([big, small], 12);
    expect(ids).toHaveLength(12);
    expect(ids).toContain("b0");
    expect(ids[0]).toBe("a0");
    expect(new Set(ids).size).toBe(12);
  });
  it("samples scenes evenly when there are more than max", () => {
    const scenes = Array.from({ length: 24 }, (_, i) => scene([`s${i}`]));
    const ids = pickVisionIds(scenes, 12);
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe("s0");
    expect(ids[1]).toBe("s2");
  });
  it("never returns more than exist", () => {
    expect(pickVisionIds([scene(["a", "b"])], 12)).toEqual(["a", "b"]);
    expect(pickVisionIds([], 12)).toEqual([]);
  });
});
