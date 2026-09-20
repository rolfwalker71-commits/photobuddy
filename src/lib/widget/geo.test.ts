import { describe, expect, it } from "vitest";
import { kmBetween, projectTrack, trackLength, trackPath } from "@/lib/widget/geo";

// Bergen → Geiranger → Trondheim → Nordkapp: 11° of latitude against 20° of
// longitude. Mercator's y is in radians, so the longitude has to be converted
// as well — mixing the two units flattens this route into a line.
const NORWAY = [
  { lat: 60.39, lon: 5.32 },
  { lat: 62.1, lon: 7.1 },
  { lat: 63.43, lon: 10.39 },
  { lat: 68.44, lon: 17.43 },
  { lat: 71.17, lon: 25.78 },
];

describe("projectTrack", () => {
  it("keeps a north-south route taller than it is wide", () => {
    const points = projectTrack(NORWAY, 314, 240);
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(height).toBeGreaterThan(width);
  });

  it("stays inside the canvas, padding included", () => {
    const [w, h, pad] = [314, 240, 14];
    for (const p of projectTrack(NORWAY, w, h, pad)) {
      expect(p.x).toBeGreaterThanOrEqual(pad - 0.001);
      expect(p.x).toBeLessThanOrEqual(w - pad + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(pad - 0.001);
      expect(p.y).toBeLessThanOrEqual(h - pad + 0.001);
    }
  });

  it("puts north at the top", () => {
    const points = projectTrack(NORWAY, 314, 240);
    expect(points[points.length - 1].y).toBeLessThan(points[0].y);
  });

  it("survives a track that never moves", () => {
    const points = projectTrack(
      [
        { lat: 47.05, lon: 8.64 },
        { lat: 47.05, lon: 8.64 },
      ],
      160,
      120,
    );
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe("distances", () => {
  it("measures a known leg", () => {
    // Bergen → Trondheim is roughly 430 km as the crow flies.
    const km = kmBetween({ lat: 60.39, lon: 5.32 }, { lat: 63.43, lon: 10.39 });
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(460);
  });

  it("adds up the legs", () => {
    const total = trackLength(NORWAY);
    let manual = 0;
    for (let i = 1; i < NORWAY.length; i++) manual += kmBetween(NORWAY[i - 1], NORWAY[i]);
    expect(total).toBeCloseTo(manual, 6);
  });

  it("is zero for a single point", () => {
    expect(trackLength([{ lat: 47.05, lon: 8.64 }])).toBe(0);
  });
});

describe("trackPath", () => {
  it("starts with a move and continues with lines", () => {
    const d = trackPath([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(d).toBe("M1.0,2.0 L3.0,4.0");
  });
});
