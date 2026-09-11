import { describe, expect, it } from "vitest";
import {
  digestBody,
  isValidTimeZone,
  joinNames,
  localDateAndHour,
  parseDigestHour,
  summarizeDigest,
} from "@/lib/digest-text";

describe("localDateAndHour", () => {
  it("uses the configured zone, not the server's", () => {
    // 18:30 UTC is 20:30 in Zürich (summer time).
    expect(localDateAndHour(new Date("2026-09-11T18:30:00Z"), "Europe/Zurich")).toEqual({
      date: "2026-09-11",
      hour: 20,
    });
    // After midnight local time the date rolls over.
    expect(localDateAndHour(new Date("2026-09-11T22:30:00Z"), "Europe/Zurich")).toEqual({
      date: "2026-09-12",
      hour: 0,
    });
    expect(localDateAndHour(new Date("2026-09-11T18:30:00Z"), "Asia/Bangkok")).toEqual({
      date: "2026-09-12",
      hour: 1,
    });
  });
});

describe("settings parsing", () => {
  it("accepts hours 0–23 only", () => {
    expect(parseDigestHour("20")).toBe(20);
    expect(parseDigestHour(0)).toBe(0);
    expect(parseDigestHour("24")).toBeNull();
    expect(parseDigestHour("7.5")).toBeNull();
    expect(parseDigestHour(null)).toBeNull();
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("Europe/Zurich")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe("summarizeDigest", () => {
  const rows = [
    { uploaded_by: "anna", author_name: "Anna", location_name: "Altdorf, Uri, Schweiz" },
    { uploaded_by: "ben", author_name: "Ben", location_name: "Flüelen, Uri" },
    { uploaded_by: "ben", author_name: "Ben", location_name: "46.8837, 8.6356" },
    { uploaded_by: "ben", author_name: "Ben", location_name: "Altdorf" },
  ];

  it("lists busiest uploaders first and real place names only", () => {
    expect(summarizeDigest(rows)).toEqual({
      count: 4,
      authors: ["Ben", "Anna"],
      places: ["Altdorf", "Flüelen"],
    });
  });

  it("leaves out the recipient's own uploads", () => {
    expect(summarizeDigest(rows, "ben")).toEqual({
      count: 1,
      authors: ["Anna"],
      places: ["Altdorf"],
    });
    expect(summarizeDigest(rows.slice(1), "ben").count).toBe(0);
  });
});

describe("digest text", () => {
  it("joins names the German way", () => {
    expect(joinNames(["Anna"])).toBe("Anna");
    expect(joinNames(["Anna", "Ben"])).toBe("Anna und Ben");
    expect(joinNames(["Anna", "Ben", "Cem"])).toBe("Anna, Ben und Cem");
    expect(joinNames(["Anna", "Ben", "Cem", "Dana", "Eli"])).toBe(
      "Anna, Ben, Cem und 2 weiteren",
    );
  });

  it("builds the notification body", () => {
    expect(
      digestBody({ count: 23, authors: ["Anna", "Ben"], places: ["Altdorf", "Flüelen"] }),
    ).toBe("Heute 23 neue Aufnahmen von Anna und Ben · Altdorf, Flüelen");
    expect(digestBody({ count: 1, authors: ["Anna"], places: [] })).toBe(
      "Heute 1 neue Aufnahme von Anna",
    );
  });
});
