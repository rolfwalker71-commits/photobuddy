"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { WidgetPreview, type WidgetFamily } from "@/components/widget-preview";
import type { WidgetPayload } from "@/lib/widget/payload";
import type { WidgetSettings } from "@/lib/widget/settings";

type Tab = "small" | "medium" | "large" | "extraLarge" | "lock";

const TABS: { value: Tab; label: string }[] = [
  { value: "small", label: "Klein" },
  { value: "medium", label: "Mittel" },
  { value: "large", label: "Gross" },
  { value: "extraLarge", label: "iPad" },
  { value: "lock", label: "Sperre" },
];

type Choice = { value: string; label: string; hint: string };

const LAYOUTS: Record<Exclude<Tab, "lock">, Choice[]> = {
  small: [
    {
      value: "lastPhoto",
      label: "Letztes Foto",
      hint: "Die neueste Aufnahme vollflächig, mit Ort und „vor 2 Std.“ auf einer Glasleiste.",
    },
    {
      value: "status",
      label: "Reise-Status",
      hint: "Tag der Reise, Aufnahmen heute, Ort und wer gerade hochlädt.",
    },
  ],
  medium: [
    {
      value: "collage",
      label: "Collage",
      hint: "Die vier neuesten Aufnahmen nebeneinander.",
    },
    { value: "lastPhoto", label: "Letztes Foto", hint: "Ein Bild, quer, mit Bildunterschrift." },
    { value: "status", label: "Reise-Status", hint: "Zahlen links, neuestes Bild rechts." },
    {
      value: "route",
      label: "Route",
      hint: "Der gefahrene Weg aus den Foto-Standorten, gezeichnet ohne Kartendienst.",
    },
  ],
  large: [
    {
      value: "lastPhoto",
      label: "Letztes Foto",
      hint: "Grosses Bild mit Bildunterschrift und drei kleineren darunter.",
    },
    { value: "collage", label: "Collage", hint: "Neun Aufnahmen als Raster." },
    { value: "route", label: "Route", hint: "Route gross, mit Ort und Zeit der letzten Aufnahme." },
  ],
  extraLarge: [
    { value: "collage", label: "Collage", hint: "Nur iPad: zwölf Aufnahmen nebeneinander." },
    { value: "route", label: "Route", hint: "Nur iPad: die Route über die ganze Breite." },
  ],
};

const LOCK_FAMILIES: { family: WidgetFamily; label: string }[] = [
  { family: "accessoryRectangular", label: "Rechteckig" },
  { family: "accessoryCircular", label: "Rund" },
  { family: "accessoryInline", label: "Über der Uhr" },
];

function Section({
  title,
  children,
  footer,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {children}
      {footer ? (
        <p className="text-sm leading-snug text-muted-foreground">{footer}</p>
      ) : null}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="glass-fill glass-interactive flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left"
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/35"
        }`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full bg-card shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function WidgetsPanel() {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [payload, setPayload] = useState<WidgetPayload | null>(null);
  const [tab, setTab] = useState<Tab>("medium");
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ settings: WidgetSettings; payload: WidgetPayload }>(
          "/api/widget/settings?preview=1",
        );
        setSettings(data.settings);
        setPayload(data.payload);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      }
    })();
  }, []);

  async function save(next: WidgetSettings) {
    setSettings(next);
    try {
      await api("/api/widget/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setStatus("Gespeichert — das Widget übernimmt es beim nächsten Aktualisieren.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  function update<K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) {
    if (!settings) return;
    void save({ ...settings, [key]: value });
  }

  async function copyScript() {
    setBusy(true);
    try {
      const script = await fetch(
        `/api/widget/script?base=${encodeURIComponent(window.location.origin)}`,
      ).then((res) => {
        if (!res.ok) throw new Error("Skript konnte nicht erstellt werden.");
        return res.text();
      });
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `${err.message} Tipp: „Skript herunterladen“ funktioniert auch ohne Zwischenablage.`
          : "Kopieren fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (
      !window.confirm(
        "Neuen Widget-Link erzeugen? Bereits kopierte Skripte hören danach auf zu funktionieren.",
      )
    ) {
      return;
    }
    await api("/api/widget/token", { method: "POST" });
    setStatus("Neuer Link erzeugt. Skript neu kopieren und in Scriptable einsetzen.");
  }

  if (!settings || !payload) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {status ?? "Widgets werden geladen…"}
      </p>
    );
  }

  const layoutKey = tab === "lock" ? null : (tab as Exclude<Tab, "lock">);
  const chosen = layoutKey ? (settings[layoutKey] as string) : null;

  return (
    <div className="space-y-4">
      <Section
        title="Vorschau"
        footer="So sieht das Widget auf dem Homescreen aus. Die Grösse wählst du beim Anlegen auf dem iPhone oder iPad."
      >
        <div
          role="tablist"
          aria-label="Widget-Grösse"
          className="glass-fill flex gap-1 rounded-2xl p-1"
        >
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={`min-h-10 flex-1 rounded-[0.8rem] px-1 text-sm transition ${
                tab === item.value
                  ? "glass-raised font-semibold shadow-card"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="scroll-touch -mx-4 overflow-x-auto px-4">
          {tab === "lock" ? (
            /* The lock screen tints everything it shows; the dark strip stands
               in for a wallpaper. */
            <div className="flex min-w-min items-center gap-4 rounded-2xl bg-neutral-800 p-4">
              {LOCK_FAMILIES.map((item) => (
                <div key={item.family} className="space-y-1.5 text-center">
                  <div className="flex justify-center">
                    <WidgetPreview
                      payload={payload}
                      settings={settings}
                      family={item.family}
                      scale={1.2}
                    />
                  </div>
                  <p className="text-xs text-white/70">{item.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-w-min justify-center py-2">
              <WidgetPreview
                payload={payload}
                settings={settings}
                family={tab as WidgetFamily}
                scale={tab === "extraLarge" ? 0.62 : 1.15}
              />
            </div>
          )}
        </div>
      </Section>

      {layoutKey ? (
        <Section title="Darstellung">
          <div className="space-y-2">
            {LAYOUTS[layoutKey].map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={chosen === choice.value}
                onClick={() =>
                  update(layoutKey, choice.value as WidgetSettings[typeof layoutKey])
                }
                className={`glass-fill glass-interactive block w-full rounded-2xl p-3 text-left ${
                  chosen === choice.value ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-semibold">{choice.label}</span>
                  {chosen === choice.value ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {choice.hint}
                </span>
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Section
          title="Sperrbildschirm"
          footer="Alle drei Varianten kommen aus demselben Skript. Beim Anlegen wählst du unter „Sperrbildschirm anpassen“, welche du möchtest."
        >
          <p className="text-sm leading-snug text-muted-foreground">
            Die Inhalte richten sich nach den Einstellungen unten — Ort, Person
            und Wetter gelten auch hier.
          </p>
        </Section>
      )}

      <Section title="Inhalt">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Album</span>
          <select
            className="glass-fill h-11 w-full rounded-2xl px-3 text-sm outline-none"
            value={settings.albumId ?? ""}
            onChange={(e) => update("albumId", e.target.value || null)}
          >
            <option value="">Zuletzt geöffnetes Album</option>
            {payload.albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Titel</span>
          <input
            className="glass-fill h-11 w-full rounded-2xl px-3 text-sm outline-none"
            placeholder={payload.album?.name ?? "Photobuddy"}
            value={settings.title}
            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            onBlur={() => void save(settings)}
          />
        </label>

        <div className="space-y-2">
          <Toggle
            label="Nur Highlights"
            checked={settings.onlyHighlights}
            onChange={(value) => update("onlyHighlights", value)}
          />
          <Toggle
            label="Ort anzeigen"
            checked={settings.showPlace}
            onChange={(value) => update("showPlace", value)}
          />
          <Toggle
            label="Wer fotografiert hat"
            checked={settings.showAuthor}
            onChange={(value) => update("showAuthor", value)}
          />
          <Toggle
            label="Wetter anzeigen"
            checked={settings.showWeather}
            onChange={(value) => update("showWeather", value)}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Erscheinungsbild</span>
          <div className="glass-fill flex gap-1 rounded-2xl p-1">
            {(
              [
                { value: "auto", label: "Automatisch" },
                { value: "light", label: "Hell" },
                { value: "dark", label: "Dunkel" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("theme", option.value)}
                className={`min-h-10 flex-1 rounded-[0.8rem] text-sm transition ${
                  settings.theme === option.value
                    ? "glass-raised font-semibold shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>
      </Section>

      <Section
        title="Auf das iPhone bringen"
        footer="Der Link im Skript ist persönlich und lesend. Gib ihn nicht weiter — und erzeuge einen neuen, falls doch."
      >
        <ol className="space-y-1.5 text-sm leading-snug text-muted-foreground">
          <li>
            1. <strong className="text-foreground">Scriptable</strong> aus dem App
            Store laden (gratis).
          </li>
          <li>2. Unten „Skript kopieren“ tippen.</li>
          <li>
            3. In Scriptable auf <strong className="text-foreground">+</strong>,
            alles einfügen, oben den Namen auf{" "}
            <strong className="text-foreground">Photobuddy</strong> setzen.
          </li>
          <li>
            4. Auf dem Homescreen lange drücken → <strong className="text-foreground">+</strong>{" "}
            → Scriptable → Grösse wählen → beim Widget „Script“ auf{" "}
            <strong className="text-foreground">Photobuddy</strong> stellen.
          </li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyScript()}
            disabled={busy}
            className="glass-accent glass-interactive inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Kopiert" : "Skript kopieren"}
          </button>
          <a
            href="/api/widget/script"
            className="glass-fill glass-interactive inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium"
          >
            <Download className="size-4" />
            Herunterladen
          </a>
          <button
            type="button"
            onClick={() => void rotate()}
            className="glass-fill glass-interactive inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium"
          >
            <RotateCcw className="size-4" />
            Neuer Link
          </button>
        </div>
      </Section>

      {status ? (
        <p className="px-1 text-sm leading-snug text-muted-foreground">{status}</p>
      ) : null}
    </div>
  );
}
