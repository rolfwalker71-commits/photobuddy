"use client";

import { useEffect, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { api } from "@/lib/api";
import {
  DEFAULT_MAP_STYLE,
  MAP_STYLE_LIST,
  isMapStyleId,
  type MapStyleId,
} from "@/lib/map-styles";

export function MapStylePicker() {
  const [selected, setSelected] = useState<MapStyleId>(DEFAULT_MAP_STYLE);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    api<{ map_style: string }>("/api/settings")
      .then((data) => {
        if (isMapStyleId(data.map_style)) setSelected(data.map_style);
      })
      .catch(() => {
        /* keep default */
      });
    api<{ user: { role: string } }>("/api/auth/me")
      .then((data) => setCanEdit(data.user.role === "admin"))
      .catch(() => setCanEdit(false));
  }, []);

  async function choose(id: MapStyleId) {
    if (!canEdit || id === selected || busy) return;
    const previous = selected;
    setSelected(id);
    setBusy(true);
    setStatus(null);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ map_style: id }),
      });
      setStatus("Kartenstil gespeichert.");
    } catch (err) {
      setSelected(previous);
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="darstellung"
      className="scroll-mt-24 space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <MapIcon className="size-4 shrink-0" aria-hidden />
        Darstellung
      </h2>
      <p className="text-sm text-muted-foreground leading-snug">
        {canEdit
          ? "Kartenstil für Galerie, Foto-Ausschnitt und Gäste-Links. Tippen speichert für alle."
          : "Aktueller Kartenstil für alle. Wechseln können nur Admins."}
      </p>
      <a
        href="/map-compare.html"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        Stile vergleichen
      </a>
      <div
        role="radiogroup"
        aria-label="Kartenstil"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {MAP_STYLE_LIST.map((style) => {
          const active = style.id === selected;
          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy || !canEdit}
              onClick={() => void choose(style.id)}
              className={`glass-fill min-h-11 rounded-2xl p-3 text-left transition ${
                active ? "ring-2 ring-primary" : ""
              } ${canEdit && !active ? "glass-interactive" : ""}`}
            >
              <span
                className="mb-2 flex h-10 overflow-hidden rounded-xl"
                aria-hidden
              >
                {style.preview.map((color) => (
                  <span
                    key={color}
                    className="h-full flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="block text-sm font-medium leading-snug break-words">
                {style.label}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground leading-snug break-words">
                {style.description}
              </span>
            </button>
          );
        })}
      </div>
      {status ? (
        <p className="text-sm text-muted-foreground leading-snug">{status}</p>
      ) : null}
    </section>
  );
}
