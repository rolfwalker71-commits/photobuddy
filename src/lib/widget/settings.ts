/**
 * What a Teilnehmer chose for their homescreen widgets. Stored as JSON on the
 * user row, so the script on the phone carries nothing but the address and the
 * token: changing a setting here takes effect on the next widget refresh, with
 * no need to copy the script again.
 */

export const SMALL_LAYOUTS = ["lastPhoto", "status"] as const;
export const MEDIUM_LAYOUTS = ["lastPhoto", "collage", "status", "route"] as const;
export const LARGE_LAYOUTS = ["lastPhoto", "collage", "route"] as const;
export const XL_LAYOUTS = ["collage", "route"] as const;
export const THEMES = ["auto", "light", "dark"] as const;

export type SmallLayout = (typeof SMALL_LAYOUTS)[number];
export type MediumLayout = (typeof MEDIUM_LAYOUTS)[number];
export type LargeLayout = (typeof LARGE_LAYOUTS)[number];
export type XLLayout = (typeof XL_LAYOUTS)[number];
export type WidgetTheme = (typeof THEMES)[number];

export type WidgetSettings = {
  /** Album the widgets show. `null` follows the most recently used album. */
  albumId: string | null;
  /** Heading; empty means the album's own name. */
  title: string;
  small: SmallLayout;
  medium: MediumLayout;
  large: LargeLayout;
  extraLarge: XLLayout;
  /** Only photos marked as a highlight. */
  onlyHighlights: boolean;
  showPlace: boolean;
  showAuthor: boolean;
  showWeather: boolean;
  theme: WidgetTheme;
};

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  albumId: null,
  title: "",
  small: "lastPhoto",
  medium: "collage",
  large: "lastPhoto",
  extraLarge: "collage",
  onlyHighlights: false,
  showPlace: true,
  showAuthor: true,
  showWeather: true,
  theme: "auto",
};

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

/** Never throws: a widget must keep rendering even if the stored JSON is odd. */
export function parseWidgetSettings(raw: string | null | undefined): WidgetSettings {
  let source: Record<string, unknown> = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      source = parsed as Record<string, unknown>;
    }
  } catch {
    source = {};
  }

  const d = DEFAULT_WIDGET_SETTINGS;
  return {
    albumId:
      typeof source.albumId === "string" && source.albumId.length > 0
        ? source.albumId
        : null,
    title: typeof source.title === "string" ? source.title.trim().slice(0, 40) : d.title,
    small: pick(source.small, SMALL_LAYOUTS, d.small),
    medium: pick(source.medium, MEDIUM_LAYOUTS, d.medium),
    large: pick(source.large, LARGE_LAYOUTS, d.large),
    extraLarge: pick(source.extraLarge, XL_LAYOUTS, d.extraLarge),
    onlyHighlights: bool(source.onlyHighlights, d.onlyHighlights),
    showPlace: bool(source.showPlace, d.showPlace),
    showAuthor: bool(source.showAuthor, d.showAuthor),
    showWeather: bool(source.showWeather, d.showWeather),
    theme: pick(source.theme, THEMES, d.theme),
  };
}

export function serializeWidgetSettings(settings: WidgetSettings) {
  return JSON.stringify(settings);
}
