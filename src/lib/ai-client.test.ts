import { describe, expect, it } from "vitest";
import {
  AI_RATE_LIMIT_FALLBACK,
  AI_UNAVAILABLE_FALLBACK,
  AiError,
  aiErrorMessage,
  aiSearchChipLabel,
  applyGallerySearch,
  canRunAiSearch,
  cleanTags,
  captionPatchBody,
  changedCaptions,
  describePatchBody,
  fillEmptyFields,
  firstDraftPlace,
  matchesTextQuery,
  recapShareText,
  reportDraftBody,
} from "@/lib/ai-client";
import type { Photo } from "@/lib/types";

function photo(id: string, extra: Partial<Photo> = {}) {
  return { id, title: null, description: null, location_name: null, tags: [], ...extra } as Photo;
}

describe("aiErrorMessage", () => {
  it("prefers the server's message", () => {
    expect(aiErrorMessage(503, "Nicht eingerichtet.")).toBe("Nicht eingerichtet.");
  });

  it("falls back for 503 and 429", () => {
    expect(aiErrorMessage(503)).toBe(AI_UNAVAILABLE_FALLBACK);
    expect(aiErrorMessage(429, "  ")).toBe(AI_RATE_LIMIT_FALLBACK);
    expect(aiErrorMessage(500)).toContain("500");
  });

  it("flags unavailable and rate limited errors", () => {
    expect(new AiError("x", 503).unavailable).toBe(true);
    expect(new AiError("x", 429).rateLimited).toBe(true);
    expect(new AiError("x", 500).unavailable).toBe(false);
  });
});

describe("cleanTags", () => {
  it("trims, strips # and dedupes case-insensitively", () => {
    expect(cleanTags([" #Strand ", "strand", "", "Sonnenuntergang"])).toEqual([
      "Strand",
      "Sonnenuntergang",
    ]);
  });
});

describe("search helpers", () => {
  it("needs three characters for the AI search", () => {
    expect(canRunAiSearch("ab")).toBe(false);
    expect(canRunAiSearch(" abc ")).toBe(true);
  });

  it("matches words across title, description, place and tags", () => {
    const p = photo("1", {
      title: "Abendessen",
      location_name: "Luzern",
      tags: [{ photo_id: "1", tag_id: "t", name: "Pizza" }],
    });
    expect(matchesTextQuery(p, "luzern pizza")).toBe(true);
    expect(matchesTextQuery(p, "luzern sushi")).toBe(false);
    expect(matchesTextQuery(p, "  ")).toBe(true);
  });

  it("narrows by AI ids, then by typed text and keeps order of photos", () => {
    const photos = [photo("a"), photo("b", { title: "Berg" }), photo("c")];
    expect(applyGallerySearch(photos, "berg", null).map((p) => p.id)).toEqual(["b"]);
    expect(
      applyGallerySearch(photos, "", { query: "x", ids: new Set(["c", "a"]) }).map(
        (p) => p.id,
      ),
    ).toEqual(["a", "c"]);
    expect(
      applyGallerySearch(photos, "berg", { query: "x", ids: new Set(["c", "a"]) }),
    ).toEqual([]);
    expect(applyGallerySearch(photos, "", null)).toHaveLength(3);
  });

  it("labels the chip", () => {
    expect(aiSearchChipLabel("Sonnenuntergang", 4)).toBe("KI-Suche: Sonnenuntergang · 4 Treffer");
  });

  it("builds the share text", () => {
    expect(recapShareText("Italien", "Es war schön.")).toBe("Italien\n\nEs war schön.");
  });
});

describe("describePatchBody", () => {
  const p = photo("1", {
    title: "Alt",
    description: null,
    location_name: "Luzern",
    latitude: 47.05,
    longitude: 8.31,
  });

  it("takes the suggestion and keeps place and coordinates", () => {
    expect(
      describePatchBody(p, { title: "Neu", description: "Text", tags: [] }),
    ).toEqual({
      title: "Neu",
      description: "Text",
      location_name: "Luzern",
      latitude: 47.05,
      longitude: 8.31,
    });
  });

  it("keeps existing text when the suggestion is empty", () => {
    expect(describePatchBody(p, { title: " ", description: "", tags: [] })).toMatchObject({
      title: "Alt",
      description: null,
    });
  });
});

describe("report draft helpers", () => {
  it("fills only empty fields", () => {
    expect(
      fillEmptyFields({ title: "Mein Titel", intro: "", text: " " }, { title: "KI", intro: "Kurz", text: "Lang" }),
    ).toEqual({ title: "Mein Titel", intro: "Kurz", text: "Lang" });
    expect(fillEmptyFields({ a: "" }, { a: "  " })).toEqual({ a: "" });
  });

  it("takes the first place in order", () => {
    expect(firstDraftPlace(["a", "b", "c"], { c: "Bern", b: "Luzern" })).toBe("Luzern");
    expect(firstDraftPlace(["a"], {})).toBe("");
  });

  it("carries title, place and coordinates over in the caption patch", () => {
    const p = photo("a", { title: "T", location_name: "Luzern", latitude: 1, longitude: 2, description: "alt" });
    expect(captionPatchBody(p, " neu ")).toEqual({
      title: "T",
      description: "neu",
      location_name: "Luzern",
      latitude: 1,
      longitude: 2,
    });
    expect(captionPatchBody(photo("b"), "").description).toBeNull();
  });

  it("finds changed captions", () => {
    const ps = [photo("a", { description: "x" }), photo("b"), photo("c", { description: "z" })];
    expect(changedCaptions(ps, { a: "x ", b: "neu", c: "y" }).map((p) => p.id)).toEqual(["b", "c"]);
  });
});

describe("reportDraftBody", () => {
  it("sends only the legacy fields without options", () => {
    expect(reportDraftBody("al", ["a"], " T ")).toEqual({ albumId: "al", photoIds: ["a"], language: "de", title: "T" });
    expect(reportDraftBody("al", ["a"], undefined, { length: "mittel", context: " ", everyone: [], people: {} })).toEqual({
      albumId: "al",
      photoIds: ["a"],
      language: "de",
    });
  });
  it("adds trimmed options and drops foreign photo ids", () => {
    expect(
      reportDraftBody("al", ["a", "b"], undefined, {
        context: " Hallo ",
        everyone: [" Anna ", ""],
        people: { a: ["Tom"], b: [], x: ["Y"] },
        length: "ausfuehrlich",
      }),
    ).toEqual({
      albumId: "al",
      photoIds: ["a", "b"],
      language: "de",
      context: "Hallo",
      everyone: ["Anna"],
      people: { a: ["Tom"], b: [] },
      length: "ausfuehrlich",
    });
  });
});
