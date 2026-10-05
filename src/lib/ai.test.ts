import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo } from "@/lib/types";

vi.mock("@/lib/auth/request", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/request")>(
    "@/lib/auth/request",
  ).catch(() => null);
  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ...(actual ?? {}),
    HttpError,
    requireTeilnehmer: vi.fn(async () => ({ id: "u1", role: "user" })),
  };
});

const ai = await import("@/lib/ai");
const guard = await import("@/lib/ai-guard");

const photo = (id: string, extra: Partial<Photo> = {}) =>
  ({
    id,
    album_id: "a",
    uploaded_by: "u1",
    created_at: "2026-07-01T10:00:00Z",
    taken_at: null,
    location_name: null,
    title: null,
    tags: [],
    kind: "photo",
    ...extra,
  }) as unknown as Photo;

beforeEach(() => {
  ai.resetAiRateLimit();
  ai.setAiChat(null);
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => ai.setAiChat(null));

describe("parseDescription", () => {
  it("clamps title, description and tags", () => {
    const out = ai.parseDescription(
      JSON.stringify({
        title: "T".repeat(100),
        description: "D".repeat(300),
        tags: ["#Berge", "SEE", "see", "a", "b", "c", "d", "e", 5],
      }),
    );
    expect(out.title.length).toBe(60);
    expect(out.description.length).toBe(200);
    expect(out.tags).toEqual(["berge", "see", "a", "b", "c", "d"]);
  });
  it("accepts fenced JSON and rejects garbage", () => {
    expect(ai.parseDescription('```json\n{"title":"Hallo","description":"x","tags":[]}\n```').title).toBe("Hallo");
    expect(() => ai.parseDescription("nope")).toThrow(ai.AiUpstreamError);
    expect(() => ai.parseDescription('{"title":"","description":""}')).toThrow();
  });
});

describe("search", () => {
  it("validates ids against the album, dedupes and caps at 60", () => {
    const valid = new Set(Array.from({ length: 100 }, (_, i) => `p${i}`));
    const ids = ["p1", "p1", "evil", ...Array.from({ length: 99 }, (_, i) => `p${i}`)];
    const out = ai.parseSearchIds(JSON.stringify({ photoIds: ids }), valid);
    expect(out).not.toContain("evil");
    expect(out.length).toBe(60);
    expect(out.filter((i) => i === "p1")).toHaveLength(1);
  });
  it("sends compact metadata and returns validated ids", async () => {
    const chat = vi.fn(async () => JSON.stringify({ photoIds: ["p1", "zzz"] }));
    ai.setAiChat(chat);
    const out = await ai.searchPhotos({
      query: "See",
      photos: [photo("p1", { location_name: "Altdorf, Uri" }), photo("p2")],
      uploaderNames: new Map([["u1", "Anna"]]),
    });
    expect(out).toEqual(["p1"]);
    const sent = JSON.stringify(chat.mock.calls[0]);
    expect(sent).toContain("Altdorf");
    expect(sent).toContain("Anna");
  });
});

describe("recap", () => {
  it("returns cleaned text", async () => {
    ai.setAiChat(async () => '  "Eine schöne Reise."  ');
    const text = await ai.writeRecap({
      albumName: "Uri",
      stats: {
        photo_count: 1, video_count: 0, media_count: 1, unique_places: 0, places: [],
        date_from: null, date_to: null, date_from_label: null, date_to_label: null,
        longest_day: null, longest_day_label: null, longest_day_count: 0,
        distance_km: null, people: [], weather: [], temp_min_c: null, temp_max_c: null,
      },
      notes: [],
    });
    expect(text).toBe("Eine schöne Reise.");
  });
});

describe("guard", () => {
  it("answers 503 in German without OPENAI_API_KEY", async () => {
    await expect(guard.requireAiUser()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("OPENAI_API_KEY"),
    });
  });
  it("rate-limits to 30 per 10 minutes", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    for (let i = 0; i < 30; i++) await guard.requireAiUser();
    await expect(guard.requireAiUser()).rejects.toMatchObject({ status: 429 });
  });
  it("allowAiRequest forgets old hits", () => {
    for (let i = 0; i < 30; i++) expect(ai.allowAiRequest("x", 0)).toBe(true);
    expect(ai.allowAiRequest("x", 1000)).toBe(false);
    expect(ai.allowAiRequest("x", 11 * 60_000)).toBe(true);
  });
});

describe("openaiChat", () => {
  it("posts to chat completions with the configured model", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "m-x";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await ai.openaiChat([{ role: "user", content: "hi" }], { json: true, maxTokens: 10 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("m-x");
    vi.unstubAllGlobals();
    delete process.env.OPENAI_MODEL;
  });
});

describe("report", () => {
  const ps = [
    photo("b", { taken_at: "2026-07-02T10:00:00Z", location_name: "Luzern" }),
    photo("v", { kind: "video" as never }),
    photo("a", { taken_at: "2026-07-01T10:00:00Z", location_name: "46.8837, 8.6356" }),
  ];
  it("skips videos and sorts by capture date", () => {
    expect(ai.reportPhotos(ps).map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("builds input with place and vision marker for the first 12 only", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      photo(`p${i}`, { taken_at: `2026-07-01T10:${String(i).padStart(2, "0")}:00Z` }),
    );
    const meta = ai.reportInput(ai.reportPhotos(many), " Ferien ");
    expect(meta.title).toBe("Ferien");
    expect(meta.photos[0].image).toBe("angehängt");
    expect(meta.photos[12].image).toBeUndefined();
    expect(ai.reportInput(ai.reportPhotos(ps)).photos[0].place).toBeUndefined();
    expect(ai.reportInput(ai.reportPhotos(ps)).photos[1].place).toBe("Luzern");
  });
  it("parses, clamps, drops foreign ids, fills fallbacks, keeps order", () => {
    const sorted = ai.reportPhotos(ps);
    const out = ai.parseReport(
      JSON.stringify({
        title: "x".repeat(200),
        intro: "Grüsse ß",
        text: `Eins.\n\nZwei.\n\n${"y".repeat(2000)}`,
        photos: [
          { id: "zzz", caption: "fremd" },
          { id: "b", caption: "z".repeat(300) },
        ],
      }),
      sorted,
      "Ferien",
    );
    expect(out.title.length).toBe(80);
    expect(out.intro).toBe("Grüsse ss");
    expect(out.text.length).toBeLessThanOrEqual(1500);
    expect(out.text.startsWith("Eins.\n\nZwei.")).toBe(true);
    expect(out.photos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(out.photos[0].caption).toBe("Ferien");
    expect(out.photos[1].caption.length).toBe(140);
  });
  it("fallbackCaption uses place and title", () => {
    expect(ai.fallbackCaption(ps[0], "Ferien")).toBe("Ferien, Luzern");
    expect(ai.fallbackCaption(ps[2])).toBe("Reisefoto");
  });
  it("rejects unparseable output with AiUpstreamError", () => {
    expect(() => ai.parseReport("nope", ai.reportPhotos(ps))).toThrow(ai.AiUpstreamError);
    expect(() => ai.parseReport('{"title":"t"}', ai.reportPhotos(ps))).toThrow(ai.AiUpstreamError);
  });
  it("writeReport sends strict JSON request and at most 12 images", async () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      photo(`p${i}`, { taken_at: `2026-07-01T10:${String(i).padStart(2, "0")}:00Z` }),
    );
    const images = new Map(many.map((p) => [p.id, { base64: "AA", mime: "image/jpeg" }]));
    const fn = vi.fn(async () => JSON.stringify({ title: "T", intro: "I", text: "X", photos: [] }));
    ai.setAiChat(fn);
    const out = await ai.writeReport({ photos: many, images });
    ai.setAiChat(null);
    const [msgs, opts] = fn.mock.calls[0] as unknown as [
      Array<{ content: Array<{ type: string }> }>,
      { json: boolean },
    ];
    expect(opts.json).toBe(true);
    expect(msgs[1].content.filter((c) => c.type === "image_url")).toHaveLength(12);
    expect(out.photos).toHaveLength(14);
  });
  it("answers 503 without key (guard)", async () => {
    await expect(guard.requireAiUser()).rejects.toMatchObject({ status: 503 });
  });
});
