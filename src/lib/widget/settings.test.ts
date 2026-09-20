import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_SETTINGS,
  parseWidgetSettings,
  serializeWidgetSettings,
} from "@/lib/widget/settings";

describe("parseWidgetSettings", () => {
  it("falls back to the defaults for missing, empty or broken JSON", () => {
    for (const input of [null, undefined, "", "{", "[]", "null", '"text"']) {
      expect(parseWidgetSettings(input)).toEqual(DEFAULT_WIDGET_SETTINGS);
    }
  });

  it("keeps known layouts and drops invented ones", () => {
    const parsed = parseWidgetSettings(
      JSON.stringify({ small: "status", medium: "route", large: "flugzeug" }),
    );
    expect(parsed.small).toBe("status");
    expect(parsed.medium).toBe("route");
    // A stale page must not be able to store a layout the script cannot draw.
    expect(parsed.large).toBe(DEFAULT_WIDGET_SETTINGS.large);
  });

  it("rejects a layout that belongs to another size", () => {
    // `status` exists, but not for the large widget.
    expect(parseWidgetSettings(JSON.stringify({ large: "status" })).large).toBe(
      DEFAULT_WIDGET_SETTINGS.large,
    );
  });

  it("trims the title and caps its length", () => {
    expect(parseWidgetSettings(JSON.stringify({ title: "  Norwegen  " })).title).toBe(
      "Norwegen",
    );
    expect(parseWidgetSettings(JSON.stringify({ title: "x".repeat(80) })).title).toHaveLength(
      40,
    );
  });

  it("treats an empty album id as 'follow the current album'", () => {
    expect(parseWidgetSettings(JSON.stringify({ albumId: "" })).albumId).toBeNull();
    expect(parseWidgetSettings(JSON.stringify({ albumId: "abc" })).albumId).toBe("abc");
  });

  it("only accepts real booleans for the toggles", () => {
    const parsed = parseWidgetSettings(
      JSON.stringify({ showPlace: "ja", showWeather: false, onlyHighlights: 1 }),
    );
    expect(parsed.showPlace).toBe(DEFAULT_WIDGET_SETTINGS.showPlace);
    expect(parsed.showWeather).toBe(false);
    expect(parsed.onlyHighlights).toBe(DEFAULT_WIDGET_SETTINGS.onlyHighlights);
  });

  it("round-trips through serialisation", () => {
    const settings = parseWidgetSettings(
      JSON.stringify({ ...DEFAULT_WIDGET_SETTINGS, theme: "dark", medium: "status" }),
    );
    expect(parseWidgetSettings(serializeWidgetSettings(settings))).toEqual(settings);
  });
});
