import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanExcerpt,
  loadPublishContext,
  normalizeLocal,
  pickPrevious,
  pickSampleCandidates,
  resetPublishContextCache,
  selectTrip,
  type PublishContextDeps,
} from "@/lib/publish-context";
import type { GravContextPost } from "@/lib/grav";

const post = (route: string, date: string, autor: string, extra: Partial<GravContextPost> = {}): GravContextPost => ({
  route,
  title: route,
  date,
  published: true,
  autor,
  intro: "",
  content: "",
  ...extra,
});

describe("normalizeLocal", () => {
  it("accepts Grav and ISO dates", () => {
    expect(normalizeLocal("2026-10-24 22:40")).toBe("2026-10-24T22:40");
    expect(normalizeLocal("2026-10-24T22:40:00+02:00")).toBe("2026-10-24T22:40");
    expect(normalizeLocal("2026-10-24")).toBe("2026-10-24T00:00");
    expect(normalizeLocal("nope")).toBeNull();
    expect(normalizeLocal(null)).toBeNull();
  });
});

describe("cleanExcerpt", () => {
  it("strips markdown and HTML and collapses whitespace", () => {
    const md = "---\ntitle: x\n---\n# Titel\n\nUm **07:40** hob [unser Flieger](http://x) ab.\n\n![bild](a.jpg)\n- Punkt <b>eins</b>\n\n\n  Zweiter   Absatz.";
    expect(cleanExcerpt(md)).toBe("Titel\n\nUm 07:40 hob unser Flieger ab. Punkt eins\n\nZweiter Absatz.");
  });
  it("clamps at a word boundary with an ellipsis", () => {
    const out = cleanExcerpt("wort ".repeat(400), 900);
    expect(out.length).toBeLessThanOrEqual(900);
    expect(out.endsWith("wort…")).toBe(true);
    expect(cleanExcerpt("kurz")).toBe("kurz");
  });
});

describe("pickPrevious / pickSampleCandidates", () => {
  const posts = [
    post("a", "2026-10-24 22:40", "valentyna"),
    post("b", "2026-10-27 10:00", "rolf"),
    post("c", "2026-09-10 08:00", "rolf"),
    post("d", "2026-10-26 09:00", "rolf", { published: false }),
    post("e", "2026-10-27 10:00", "harry"),
  ];
  it("takes the latest published post strictly before the date", () => {
    expect(pickPrevious(posts, "2026-10-27T10:00")?.route).toBe("a");
    expect(pickPrevious(posts, "2026-10-28T00:00")?.route).toMatch(/b|e/);
    expect(pickPrevious(posts, "2026-09-01T00:00")).toBeNull();
    expect(pickPrevious(posts, "kaputt")).toBeNull();
  });
  it("prefers the author's posts, otherwise any, max two", () => {
    expect(pickSampleCandidates(posts, "rolf").map((p) => p.route)).toEqual(["b", "c"]);
    expect(pickSampleCandidates(posts, "niemand")).toHaveLength(2);
    expect(pickSampleCandidates(posts, "")).toHaveLength(2);
  });
});

describe("selectTrip", () => {
  const data = {
    start: "2026-10-23T10:11",
    tage: 29,
    stationen: [
      { ort: "Zürich", land: "Schweiz", an: "2026-10-23T10:11", ab: "2026-10-23T12:20" },
      { ort: "Barcelona", land: "Spanien", an: "2026-10-23T14:05", ab: "2026-10-25T17:00" },
      { ort: "Palma", land: "Spanien", an: "2026-10-26T07:30", ab: "2026-10-26T15:30" },
      { ort: "Málaga", land: "Spanien", an: "2026-10-27T08:00", ab: "2026-10-27T17:00" },
      { ort: "Fort Lauderdale", land: "USA", an: "2026-11-07T07:00", ab: "2026-11-07T12:00" },
    ],
    strecken: [
      { art: "flug", von: "Zürich", mit: "Swiss LX 1954", ab: "2026-10-23T12:20" },
      { art: "schiff", von: "Barcelona", mit: "Legend of the Seas", ab: "2026-10-25T17:00" },
      { art: "schiff", von: "Palma", mit: "Legend of the Seas", ab: "2026-10-26T15:30" },
    ],
  };
  it("selects stations within ±2 days with Reisetag", () => {
    const trip = selectTrip(data, "2026-10-26T12:00");
    expect(trip?.day).toBe(4);
    expect(trip?.days).toBe(29);
    expect(trip?.stations.map((s) => s.name)).toEqual(["Barcelona", "Palma", "Málaga"]);
    expect(trip?.stations[1]).toEqual({
      name: "Palma",
      country: "Spanien",
      arrival: "2026-10-26T07:30",
      departure: "2026-10-26T15:30",
      transport: "Legend of the Seas",
    });
  });
  it("adds the neighbours during long legs", () => {
    const trip = selectTrip(data, "2026-11-01T12:00");
    expect(trip?.stations.map((s) => s.name)).toEqual(["Málaga", "Fort Lauderdale"]);
  });
  it("has no Reisetag outside the trip and caps at six stations", () => {
    expect(selectTrip(data, "2026-09-01T12:00")?.day).toBeNull();
    const many = {
      ...data,
      stationen: Array.from({ length: 10 }, (_, i) => ({ ort: `S${i}`, an: `2026-10-26T0${i}:00`, ab: `2026-10-26T0${i}:30` })),
    };
    expect(selectTrip(many, "2026-10-26T05:00")?.stations).toHaveLength(6);
    expect(selectTrip(null, "2026-10-26T05:00")).toBeNull();
  });
});

describe("loadPublishContext", () => {
  beforeEach(() => resetPublishContextCache());
  const make = (over: Partial<PublishContextDeps> = {}) => {
    const deps = {
      configured: () => true,
      tripData: vi.fn(async () => ({ start: "2026-10-23T10:00", tage: 29, stationen: [], strecken: [] })),
      posts: vi.fn(async () => [
        post("/t/2026-10-24", "2026-10-24 10:00", "rolf", { intro: "Intro 24" }),
        post("/t/2026-10-20", "2026-10-20 10:00", "rolf"),
        post("/t/2026-10-10", "2026-10-10 10:00", "rolf"),
      ]),
      page: vi.fn(async (route: string) => ({ header: { autor: "rolf", intro: "x" }, content: `Wir sind **hier** (${route}).` })),
      ...over,
    } satisfies PublishContextDeps;
    return deps;
  };
  it("returns empty parts when Grav is not configured", async () => {
    const deps = make({ configured: () => false });
    expect(await loadPublishContext("rolf", "2026-10-25T10:00", deps)).toEqual({ trip: null, samples: [], previous: null });
    expect(deps.posts).not.toHaveBeenCalled();
  });
  it("combines trip, samples and previous within four requests and caches", async () => {
    const deps = make();
    const ctx = await loadPublishContext("rolf", "2026-10-25T10:00", deps);
    expect(ctx.previous).toEqual({ title: "/t/2026-10-24", date: "2026-10-24T10:00", intro: "Intro 24" });
    expect(ctx.samples.map((s) => s.title)).toEqual(["/t/2026-10-24", "/t/2026-10-20"]);
    expect(ctx.samples[0].excerpt).toBe("Wir sind hier (/t/2026-10-24).");
    expect(ctx.trip).toMatchObject({ day: 3, days: 29 });
    const calls = (deps.tripData as ReturnType<typeof vi.fn>).mock.calls.length + (deps.posts as ReturnType<typeof vi.fn>).mock.calls.length + (deps.page as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(calls).toBeLessThanOrEqual(4);
    await loadPublishContext("rolf", "2026-10-25T10:00", deps);
    expect(deps.posts).toHaveBeenCalledTimes(1);
    expect(deps.page).toHaveBeenCalledTimes(2);
  });
  it("ignores failing lookups", async () => {
    const deps = make({
      tripData: vi.fn(async () => { throw new Error("down"); }),
      page: vi.fn(async () => { throw new Error("down"); }),
    });
    const ctx = await loadPublishContext("rolf", "2026-10-25T10:00", deps);
    expect(ctx.trip).toBeNull();
    expect(ctx.samples).toEqual([]);
    expect(ctx.previous?.title).toBe("/t/2026-10-24");
  });
});
