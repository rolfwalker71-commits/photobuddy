"use client";

/**
 * A homescreen widget as it will look on the phone, drawn in the browser.
 *
 * The Scriptable script (src/lib/widget/script.ts) is the real renderer; this
 * mirrors its layouts so the settings page can show what a choice does before
 * anyone copies a script. Both draw from the same payload, so the two stay
 * honest about content — keep them in step when a layout changes.
 */

import { projectTrack, trackLength, trackPath } from "@/lib/widget/geo";
import type { WidgetPayload, WidgetPhoto } from "@/lib/widget/payload";
import type { WidgetSettings } from "@/lib/widget/settings";

export type WidgetFamily =
  | "small"
  | "medium"
  | "large"
  | "extraLarge"
  | "accessoryCircular"
  | "accessoryRectangular"
  | "accessoryInline";

/** Widget sizes in points on a 6.1" iPhone; the iPad tile follows an 11" iPad. */
export const FAMILY_SIZE: Record<WidgetFamily, { w: number; h: number }> = {
  small: { w: 158, h: 158 },
  medium: { w: 338, h: 158 },
  large: { w: 338, h: 354 },
  extraLarge: { w: 715, h: 342 },
  accessoryCircular: { w: 72, h: 72 },
  accessoryRectangular: { w: 160, h: 72 },
  accessoryInline: { w: 240, h: 26 },
};

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

function relative(value: string | null, now: Date) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const mins = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (mins < 2) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return `${then.getDate()}. ${MONTHS[then.getMonth()]}`;
}

function weatherGlyph(code: number | null) {
  if (code == null) return "";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫";
  if (code <= 67) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌦";
  if (code <= 86) return "🌨";
  return "⛈";
}

function weatherText(photo: WidgetPhoto, settings: WidgetSettings) {
  if (!settings.showWeather) return "";
  const temp = photo.tempC == null ? "" : `${Math.round(photo.tempC)}°`;
  return `${weatherGlyph(photo.weatherCode)} ${temp}`.trim();
}

function titleOf(payload: WidgetPayload, settings: WidgetSettings) {
  return settings.title || payload.album?.name || "Photobuddy";
}

/** The translucent pane the script draws over a photo. */
function Pane({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[0.75rem] bg-[#0b1014]/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-[2px] ${className}`}
    >
      {children}
    </div>
  );
}

function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-start gap-1.5 bg-[var(--wg-bg)] p-3.5">
      <p className="text-[0.85em] font-bold text-[var(--wg-ink)]">{title}</p>
      <p className="text-[0.7em] leading-snug text-[var(--wg-muted)]">{line}</p>
    </div>
  );
}

function Hero({
  payload,
  settings,
  family,
  now,
}: {
  payload: WidgetPayload;
  settings: WidgetSettings;
  family: WidgetFamily;
  now: Date;
}) {
  const photo = payload.photos[0];
  if (!photo) {
    return (
      <Empty
        title={titleOf(payload, settings)}
        line={
          settings.onlyHighlights
            ? "Noch keine Highlights markiert."
            : "Noch keine Aufnahmen in diesem Album."
        }
      />
    );
  }

  const small = family === "small";
  const weather = weatherText(photo, settings);
  const meta = [relative(photo.takenAt, now)];
  if (settings.showAuthor) meta.push(photo.author);
  const strip = family === "large" ? payload.photos.slice(1, 4) : [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--wg-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.image} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/65" />
      <div className={`relative flex h-full flex-col ${small ? "p-2.5" : "p-3"}`}>
        <div className="flex items-start gap-1.5">
          {photo.isHighlight ? (
            <Pane className="px-1.5 py-0.5 text-[0.62em] font-bold">★</Pane>
          ) : null}
          <div className="flex-1" />
          {weather ? (
            <Pane className="px-1.5 py-0.5 text-[0.62em] font-semibold">{weather}</Pane>
          ) : null}
        </div>
        <div className="flex-1" />
        <Pane className={small ? "px-2 py-1.5" : "px-2.5 py-2"}>
          <p
            className={`truncate font-bold leading-tight ${small ? "text-[0.8em]" : "text-[0.92em]"}`}
          >
            {(settings.showPlace && photo.place) || photo.title || titleOf(payload, settings)}
          </p>
          <p className={`truncate text-white/85 ${small ? "text-[0.62em]" : "text-[0.68em]"}`}>
            {meta.filter(Boolean).join(" · ")}
          </p>
        </Pane>
        {strip.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {strip.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.thumb}
                alt=""
                className="aspect-[4/3] w-full rounded-[0.6rem] object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Collage({
  payload,
  settings,
  family,
}: {
  payload: WidgetPayload;
  settings: WidgetSettings;
  family: WidgetFamily;
}) {
  if (payload.photos.length === 0) {
    return (
      <Empty
        title={titleOf(payload, settings)}
        line={
          settings.onlyHighlights
            ? "Noch keine Highlights markiert."
            : "Noch keine Aufnahmen in diesem Album."
        }
      />
    );
  }

  const cols = family === "medium" ? 4 : family === "large" ? 3 : 6;
  const rows = family === "medium" ? 1 : family === "large" ? 3 : 2;
  const cells = Array.from({ length: cols * rows }, (_, i) => payload.photos[i] ?? null);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--wg-bg)] p-3">
      <div className="flex items-baseline gap-2">
        <p className="truncate text-[0.72em] font-bold text-[var(--wg-ink)]">
          {titleOf(payload, settings)}
        </p>
        <div className="flex-1" />
        <p className="shrink-0 text-[0.62em] text-[var(--wg-muted)]">
          {payload.stats.today > 0
            ? `${payload.stats.today} heute`
            : `${payload.stats.total} Fotos`}
        </p>
      </div>
      <div
        className="mt-2 grid flex-1 gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((photo, i) =>
          photo ? (
            <div key={photo.id} className="relative overflow-hidden rounded-[0.7rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumb} alt="" className="size-full object-cover" />
              {photo.isVideo || photo.isHighlight ? (
                <Pane className="absolute bottom-1 right-1 px-1 py-px text-[0.55em] font-bold">
                  {photo.isVideo ? "▶" : "★"}
                </Pane>
              ) : null}
            </div>
          ) : (
            <div key={`gap-${i}`} className="rounded-[0.7rem] bg-[var(--wg-hole)]" />
          ),
        )}
      </div>
    </div>
  );
}

function Status({
  payload,
  settings,
  family,
  now,
}: {
  payload: WidgetPayload;
  settings: WidgetSettings;
  family: WidgetFamily;
  now: Date;
}) {
  const { album, stats } = payload;
  const photo = payload.photos[0];
  const small = family === "small";
  const people = stats.contributors.slice(0, small ? 3 : 4);
  const line =
    stats.today > 0
      ? `${stats.today} ${stats.today === 1 ? "Aufnahme" : "Aufnahmen"} heute`
      : `${stats.week} in dieser Woche`;

  return (
    <div className="flex h-full w-full gap-3 bg-[var(--wg-bg)] p-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[0.7em] font-bold text-[var(--wg-muted)]">
            {titleOf(payload, settings)}
          </p>
          {!small && photo && settings.showWeather ? (
            <>
              <div className="flex-1" />
              <p className="shrink-0 text-[0.7em] font-semibold text-[var(--wg-muted)]">
                {weatherText(photo, settings)}
              </p>
            </>
          ) : null}
        </div>

        <div className={small ? "mt-1.5" : "mt-2.5"}>
          {album?.day ? (
            <p className="flex items-baseline gap-1.5">
              <span
                className={`font-extrabold leading-none text-[var(--wg-ink)] ${small ? "text-[1.6em]" : "text-[1.9em]"}`}
              >
                Tag {album.day}
              </span>
              {album.days ? (
                <span className="text-[0.7em] text-[var(--wg-muted)]">von {album.days}</span>
              ) : null}
            </p>
          ) : (
            <p
              className={`font-extrabold leading-none text-[var(--wg-ink)] ${small ? "text-[1.5em]" : "text-[1.9em]"}`}
            >
              {stats.total} Fotos
            </p>
          )}
        </div>

        <p className={`mt-1 text-[0.72em] font-semibold text-[var(--wg-accent)]`}>{line}</p>
        {settings.showPlace && stats.place ? (
          <p className="truncate text-[0.68em] text-[var(--wg-muted)]">{stats.place}</p>
        ) : null}

        <div className="flex-1" />

        {settings.showAuthor && people.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {people.map((person) => (
              <span
                key={person.name}
                className="size-2 shrink-0 rounded-full"
                style={{ background: person.color }}
              />
            ))}
            <span className="truncate text-[0.6em] text-[var(--wg-muted)]">
              {people.map((p) => p.name.split(" ")[0]).join(", ")}
            </span>
          </div>
        ) : null}
      </div>

      {family === "medium" && photo ? (
        <div className="relative aspect-square h-full shrink-0 overflow-hidden rounded-[1rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb} alt="" className="size-full object-cover" />
          <Pane className="absolute bottom-1.5 left-1.5 right-1.5 truncate px-1.5 py-0.5 text-[0.55em] font-semibold">
            {relative(photo.takenAt, now)}
          </Pane>
        </div>
      ) : null}
    </div>
  );
}

function Route({
  payload,
  settings,
  family,
  now,
}: {
  payload: WidgetPayload;
  settings: WidgetSettings;
  family: WidgetFamily;
  now: Date;
}) {
  const track = payload.track;
  if (track.length < 2) {
    return (
      <Empty
        title={titleOf(payload, settings)}
        line="Für die Route braucht es mindestens zwei Aufnahmen mit Standort."
      />
    );
  }

  const size = FAMILY_SIZE[family];
  const canvasW = size.w - 24;
  const canvasH = size.h - 24 - 26 - (family === "medium" ? 0 : 30);

  const screen = projectTrack(track, canvasW, canvasH);
  const d = trackPath(screen);

  const km = trackLength(track);
  const start = screen[0];
  const end = screen[screen.length - 1];
  const photo = payload.photos[0];

  return (
    <div className="flex h-full w-full flex-col bg-[var(--wg-bg)] p-3">
      <div className="flex items-baseline gap-2">
        <p className="truncate text-[0.72em] font-bold text-[var(--wg-ink)]">
          {titleOf(payload, settings)}
        </p>
        <div className="flex-1" />
        {km >= 1 ? (
          <p className="shrink-0 text-[0.62em] text-[var(--wg-muted)]">{Math.round(km)} km</p>
        ) : null}
      </div>
      <div className="mt-1.5 flex-1 overflow-hidden rounded-[1rem] bg-[var(--wg-map)]">
        <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="size-full" aria-hidden>
          <path d={d} fill="none" stroke="var(--wg-casing)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke="var(--wg-accent)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={start.x} cy={start.y} r={5} fill="var(--wg-bg)" stroke="var(--wg-accent)" strokeWidth={2.5} />
          <circle cx={end.x} cy={end.y} r={7} fill="#ffffff" />
          <circle cx={end.x} cy={end.y} r={5} fill="var(--wg-warm)" />
        </svg>
      </div>
      {family !== "medium" ? (
        <div className="mt-2 flex items-baseline gap-2">
          <p className="truncate text-[0.7em] font-semibold text-[var(--wg-ink)]">
            {photo && settings.showPlace && photo.place
              ? photo.place
              : `${track.length} Stationen`}
          </p>
          <div className="flex-1" />
          {photo ? (
            <p className="shrink-0 text-[0.65em] text-[var(--wg-muted)]">
              {relative(photo.takenAt, now)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LockScreen({
  payload,
  settings,
  family,
  now,
}: {
  payload: WidgetPayload;
  settings: WidgetSettings;
  family: WidgetFamily;
  now: Date;
}) {
  const photo = payload.photos[0];
  const { stats } = payload;

  if (family === "accessoryInline") {
    const bits = [stats.today > 0 ? `${stats.today} heute` : `${stats.total} Fotos`];
    if (settings.showPlace && photo?.place) bits.push(photo.place);
    return (
      <p className="whitespace-nowrap text-[0.8em] text-white">📷 {bits.join(" · ")}</p>
    );
  }

  if (family === "accessoryCircular") {
    return (
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-white/20 text-white">
        <span className="text-[1.4em] font-bold leading-none">
          {stats.today > 0 ? stats.today : stats.total}
        </span>
        <span className="text-[0.55em]">{stats.today > 0 ? "heute" : "Fotos"}</span>
      </div>
    );
  }

  const meta: string[] = [];
  if (photo) {
    if (settings.showPlace && photo.place) meta.push(relative(photo.takenAt, now));
    if (stats.today > 0) meta.push(`${stats.today} heute`);
  }

  return (
    <div className="flex size-full flex-col justify-center rounded-[0.5rem] bg-white/15 px-2 py-1 text-white">
      <p className="truncate text-[0.7em] font-semibold">{titleOf(payload, settings)}</p>
      {photo ? (
        <>
          <p className="truncate text-[0.85em] font-bold">
            {settings.showPlace && photo.place ? photo.place : relative(photo.takenAt, now)}
          </p>
          <p className="truncate text-[0.65em] text-white/80">{meta.join(" · ")}</p>
        </>
      ) : (
        <p className="text-[0.65em] text-white/80">Noch keine Aufnahmen</p>
      )}
    </div>
  );
}

export function WidgetPreview({
  payload,
  family,
  layout,
  settings,
  scale = 1,
  now = new Date(),
}: {
  payload: WidgetPayload;
  family: WidgetFamily;
  /** Layout for the home-screen families; ignored on the lock screen. */
  layout?: string;
  settings?: WidgetSettings;
  scale?: number;
  now?: Date;
}) {
  const s = settings ?? payload.settings;
  const size = FAMILY_SIZE[family];
  const lock = family.startsWith("accessory");
  const chosen =
    layout ??
    (family === "small"
      ? s.small
      : family === "medium"
        ? s.medium
        : family === "large"
          ? s.large
          : s.extraLarge);

  const body = lock ? (
    <LockScreen payload={payload} settings={s} family={family} now={now} />
  ) : chosen === "collage" ? (
    <Collage payload={payload} settings={s} family={family} />
  ) : chosen === "status" ? (
    <Status payload={payload} settings={s} family={family} now={now} />
  ) : chosen === "route" ? (
    <Route payload={payload} settings={s} family={family} now={now} />
  ) : (
    <Hero payload={payload} settings={s} family={family} now={now} />
  );

  return (
    <div
      className={`widget-preview shrink-0 overflow-hidden ${
        lock ? "" : "rounded-[1.4rem] shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.22)]"
      }`}
      data-wg-theme={s.theme}
      style={{
        width: size.w * scale,
        height: size.h * scale,
        // Everything inside sizes in `em`. iOS renders the same type size in
        // every widget family — a medium tile is wider, not bigger — so this
        // must not scale with the tile's width.
        fontSize: `${13 * scale}px`,
      }}
      data-family={family}
    >
      {body}
    </div>
  );
}
