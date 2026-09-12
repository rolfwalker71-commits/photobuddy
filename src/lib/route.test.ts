import { describe, expect, it } from "vitest";
import {
  ROUTE_COLORS,
  buildDayBridges,
  buildDayRoutes,
  formatKm,
  haversineKm,
} from "@/lib/route";

const photo = (latitude: number, longitude: number, taken_at: string) => ({
  latitude,
  longitude,
  taken_at,
  created_at: taken_at,
});
const day = (p: { taken_at: string }) => p.taken_at.slice(0, 10);

describe("haversineKm", () => {
  it("measures Zürich–Bern at about 95 km", () => {
    expect(haversineKm([47.3769, 8.5417], [46.948, 7.4474])).toBeCloseTo(95, 0);
  });

  it("is zero for the same point", () => {
    expect(haversineKm([46.88, 8.64], [46.88, 8.64])).toBe(0);
  });
});

describe("buildDayRoutes", () => {
  it("orders days and points chronologically", () => {
    const routes = buildDayRoutes(
      [
        photo(46.9, 8.6, "2026-09-12T15:00:00Z"),
        photo(46.8, 8.6, "2026-09-11T18:00:00Z"),
        photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
      ],
      day,
    );
    expect(routes.map((route) => route.day)).toEqual(["2026-09-11", "2026-09-12"]);
    expect(routes[0].points).toEqual([
      [46.7, 8.6],
      [46.8, 8.6],
    ]);
    expect(routes[0].distanceKm).toBeCloseTo(11.1, 1);
    expect(routes[1].points).toHaveLength(1);
    expect(routes[1].distanceKm).toBe(0);
  });

  it("keeps day colours stable by trip position", () => {
    const routes = buildDayRoutes(
      Array.from({ length: 10 }, (_, i) =>
        photo(46, 8, `2026-09-${String(i + 1).padStart(2, "0")}T12:00:00Z`),
      ),
      day,
    );
    expect(routes[0].color).toBe(ROUTE_COLORS[0]);
    expect(routes[1].color).toBe(ROUTE_COLORS[1]);
    expect(routes[8].color).toBe(ROUTE_COLORS[0]);
  });

  it("drops consecutive photos at the same spot", () => {
    const [route] = buildDayRoutes(
      [
        photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
        photo(46.7, 8.6, "2026-09-11T09:01:00Z"),
        photo(46.8, 8.6, "2026-09-11T10:00:00Z"),
      ],
      day,
    );
    expect(route.points).toHaveLength(2);
  });
});

describe("buildDayBridges", () => {
  const routes = buildDayRoutes(
    [
      photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
      photo(46.8, 8.6, "2026-09-11T18:00:00Z"),
      photo(46.9, 8.6, "2026-09-12T10:00:00Z"),
      photo(47.0, 8.6, "2026-09-12T17:00:00Z"),
    ],
    day,
  );

  it("joins the last photo of a day to the first of the next", () => {
    const [bridge] = buildDayBridges(routes);
    expect(bridge.points).toEqual([
      [46.8, 8.6],
      [46.9, 8.6],
    ]);
    expect(bridge.fromDay).toBe("2026-09-11");
    expect(bridge.toDay).toBe("2026-09-12");
    expect(bridge.distanceKm).toBeCloseTo(11.1, 1);
  });

  it("takes the arriving day's colour", () => {
    expect(buildDayBridges(routes)[0].color).toBe(ROUTE_COLORS[1]);
  });

  it("needs no second point in a day, so single-photo days still connect", () => {
    const single = buildDayRoutes(
      [
        photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
        photo(46.9, 8.6, "2026-09-12T10:00:00Z"),
        photo(47.1, 8.6, "2026-09-13T10:00:00Z"),
      ],
      day,
    );
    expect(buildDayBridges(single)).toHaveLength(2);
  });

  it("skips a hop that would have zero length", () => {
    const sameSpot = buildDayRoutes(
      [
        photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
        photo(46.7, 8.6, "2026-09-12T10:00:00Z"),
      ],
      day,
    );
    expect(buildDayBridges(sameSpot)).toEqual([]);
  });

  it("has nothing to bridge on a one-day trip", () => {
    const oneDay = buildDayRoutes(
      [
        photo(46.7, 8.6, "2026-09-11T09:00:00Z"),
        photo(46.8, 8.6, "2026-09-11T18:00:00Z"),
      ],
      day,
    );
    expect(buildDayBridges(oneDay)).toEqual([]);
  });
});

describe("formatKm", () => {
  it("switches units and precision", () => {
    expect(formatKm(0.4)).toBe("400 m");
    expect(formatKm(3.25)).toBe("3.3 km");
    expect(formatKm(123.4)).toBe("123 km");
  });
});
