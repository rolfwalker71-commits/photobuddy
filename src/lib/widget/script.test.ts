import { describe, expect, it } from "vitest";
import { buildWidgetScript } from "@/lib/widget/script";

const TOKEN = "cZ9-widget-token-example";

describe("buildWidgetScript", () => {
  it("bakes in the address and the token", () => {
    const script = buildWidgetScript("https://reise.example.ch", TOKEN);
    expect(script).toContain('const BASE = "https://reise.example.ch"');
    expect(script).toContain(`const TOKEN = "${TOKEN}"`);
  });

  it("drops a trailing slash, so no URL ends up with two", () => {
    expect(buildWidgetScript("https://reise.example.ch/", TOKEN)).toContain(
      'const BASE = "https://reise.example.ch"',
    );
  });

  it("leaves no placeholder behind", () => {
    const script = buildWidgetScript("https://reise.example.ch", TOKEN);
    expect(script).not.toContain("__BASE__");
    expect(script).not.toContain("__TOKEN__");
  });

  it("carries no template interpolation", () => {
    // The script lives inside String.raw: a `${` in its body would have been
    // evaluated at build time instead of shipping to the phone.
    expect(buildWidgetScript("https://reise.example.ch", TOKEN)).not.toContain("${");
  });

  it("starts with the header Scriptable requires", () => {
    const script = buildWidgetScript("https://reise.example.ch", TOKEN);
    expect(script.startsWith("// Variables used by Scriptable.")).toBe(true);
    expect(script).toContain("icon-glyph:");
  });

  it("offers every layout the settings allow", () => {
    const script = buildWidgetScript("https://reise.example.ch", TOKEN);
    for (const layout of ["lastPhoto", "collage", "status", "route"]) {
      expect(script).toContain(`${layout}:`);
    }
    for (const family of ["accessoryCircular", "accessoryRectangular", "accessoryInline"]) {
      expect(script).toContain(family);
    }
  });

  it("escapes a token that would otherwise break out of its string", () => {
    const script = buildWidgetScript("https://reise.example.ch", 'a"; evil();//');
    expect(script).toContain('const TOKEN = "a\\"; evil();//"');
  });
});
