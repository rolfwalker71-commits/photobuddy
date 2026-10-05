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
