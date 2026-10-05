import { describe, expect, it } from "vitest";
import { formatPrettyDate, formatPrettyRange } from "@/lib/pretty-date";

describe("formatPrettyDate", () => {
  it("prints day, short month and year", () => {
    expect(formatPrettyDate("2026-09-12")).toBe("12. Sept. 2026");
    expect(formatPrettyDate("2026-03-05")).toBe("5. März 2026");
  });

  it("returns null for junk", () => {
    expect(formatPrettyDate(null)).toBeNull();
    expect(formatPrettyDate("")).toBeNull();
  });
});

describe("formatPrettyRange", () => {
  it("collapses a single day", () => {
    expect(formatPrettyRange("2026-09-12", "2026-09-12")).toBe("12. Sept. 2026");
    expect(formatPrettyRange("2026-09-12", null)).toBe("12. Sept. 2026");
  });

  it("collapses within a month and a year", () => {
    expect(formatPrettyRange("2026-09-12", "2026-09-15")).toBe("12.–15. Sept. 2026");
    expect(formatPrettyRange("2026-08-28", "2026-09-03")).toBe("28. Aug. – 3. Sept. 2026");
  });

  it("keeps both years across a year boundary", () => {
    expect(formatPrettyRange("2025-12-30", "2026-01-02")).toBe(
      "30. Dez. 2025 – 2. Jan. 2026",
    );
  });
});
