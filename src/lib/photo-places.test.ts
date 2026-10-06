import { describe, expect, it, vi } from "vitest";
import { placesMap, resolveMissingPlaces } from "@/lib/photo-places";
import type { Photo } from "@/lib/types";

function photo(id: string, extra: Partial<Photo> = {}) {
  return { id, location_name: null, latitude: null, longitude: null, ...extra } as Photo;
}

describe("resolveMissingPlaces", () => {
  it("de-duplicates by coordinates rounded to 3 decimals", async () => {
    const lookup = vi.fn(async () => "Luzern LU");
    const out = await resolveMissingPlaces(
      [
        photo("a", { latitude: 47.05041, longitude: 8.30941 }),
        photo("b", { latitude: 47.05049, longitude: 8.30949 }),
        photo("c", { latitude: 46.5, longitude: 8.1 }),
      ],
      lookup,
    );
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(out.get("a")).toBe("Luzern LU");
    expect(out.get("b")).toBe("Luzern LU");
    expect(out.get("c")).toBe("Luzern LU");
  });

  it("skips named photos and photos without coordinates, treats coordinate labels as missing", async () => {
    const lookup = vi.fn(async () => "Bern BE");
    const out = await resolveMissingPlaces(
      [
        photo("a", { location_name: "Zug", latitude: 1, longitude: 2 }),
        photo("b", { latitude: null, longitude: null }),
        photo("c", { location_name: "46.8837, 8.6356", latitude: 46.8837, longitude: 8.6356 }),
      ],
      lookup,
    );
    expect([...out.keys()]).toEqual(["c"]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("tolerates failures and null results", async () => {
    const lookup = vi
      .fn<(a: number, b: number) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("Chur GR");
    const out = await resolveMissingPlaces(
      [
        photo("a", { latitude: 1, longitude: 1 }),
        photo("b", { latitude: 2, longitude: 2 }),
        photo("c", { latitude: 3, longitude: 3 }),
      ],
      lookup,
    );
    expect([...out.entries()]).toEqual([["c", "Chur GR"]]);
  });

  it("respects the cap", async () => {
    const lookup = vi.fn(async () => "X");
    const photos = Array.from({ length: 20 }, (_, i) => photo(`p${i}`, { latitude: i, longitude: i }));
    const out = await resolveMissingPlaces(photos, lookup, 12);
    expect(lookup).toHaveBeenCalledTimes(12);
    expect(out.size).toBe(12);
  });
});

describe("placesMap", () => {
  it("only lists real names", () => {
    expect(
      placesMap([photo("a", { location_name: "Luzern" }), photo("b", { location_name: "1.5, 2.5" }), photo("c")]),
    ).toEqual({ a: "Luzern" });
  });
});
