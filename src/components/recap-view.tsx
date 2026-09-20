"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudSun, MapPin, PartyPopper, Sun } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { WeatherChip } from "@/components/weather-chip";
import { getStoredAlbumId } from "@/lib/album";
import { api, withKey } from "@/lib/api";
import { appHref } from "@/lib/paths";
import type { RecapStats } from "@/lib/recap";
import type { Album as AlbumRow, ViewerMode } from "@/lib/types";

type RecapResponse = {
  album: AlbumRow | null;
  stats: RecapStats;
};

export function RecapView({
  mode,
  shareKey,
}: {
  mode: ViewerMode;
  shareKey: string | null;
}) {
  const [albumId, setAlbumId] = useState<string | null>(
    mode === "guest" ? null : getStoredAlbumId(),
  );
  const [data, setData] = useState<RecapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "guest") return;
    void api<{ albums?: AlbumRow[]; currentAlbum?: AlbumRow | null }>(
      withKey("/api/trip", null, albumId),
    )
      .then((trip) => {
        const id = trip.currentAlbum?.id ?? trip.albums?.[0]?.id ?? albumId;
        setAlbumId(id ?? null);
      })
      .catch(() => undefined);
  }, [albumId, mode]);

  useEffect(() => {
    const id = mode === "guest" ? undefined : albumId;
    if (mode !== "guest" && !id) return;
    const path =
      mode === "guest"
        ? withKey("/api/trip", shareKey)
        : withKey("/api/trip", null, id);
    void api<{ currentAlbum?: AlbumRow | null }>(path)
      .then((trip) => {
        const current = trip.currentAlbum;
        if (!current) {
          setError("Kein Album gefunden.");
          return;
        }
        setAlbumId(current.id);
        return api<RecapResponse>(
          withKey(`/api/albums/${current.id}/recap`, shareKey),
        ).then(setData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      });
  }, [albumId, mode, shareKey]);

  async function backfillWeather() {
    if (!data?.album || mode !== "teilnehmer") return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await api<{ updated: number; scanned: number }>(
        `/api/albums/${data.album.id}/weather-backfill`,
        { method: "POST" },
      );
      setStatus(
        result.updated > 0
          ? `Wetter für ${result.updated} Fotos ergänzt.`
          : "Keine neuen Wetterdaten gefunden.",
      );
      const next = await api<RecapResponse>(
        `/api/albums/${data.album.id}/recap`,
      );
      setData(next);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wetterabgleich fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const stats = data?.stats;
  const title = data?.album?.name || "Reise-Rückblick";

  return (
    <div className="app-shell">
      <AppHeader title="Reise-Rückblick" subtitle={title} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <Link
          href={appHref(mode, shareKey, "gallery")}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted glass-interactive px-3 text-sm font-medium"
        >
          <ArrowLeft className="size-4" />
          Zurück zur Galerie
        </Link>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !stats ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Rückblick wird geladen…
          </p>
        ) : (
          <>
            <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card ring-1 ring-border">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                <PartyPopper className="size-5" aria-hidden />
                So war die Reise
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Fotos" value={stats.photo_count} />
                <StatCard label="Videos" value={stats.video_count} />
                <StatCard label="Orte" value={stats.unique_places} />
                <StatCard
                  label="Kilometer"
                  value={stats.distance_km == null ? "—" : stats.distance_km}
                />
              </div>
              <p className="text-sm leading-snug text-muted-foreground">
                {stats.date_from_label && stats.date_to_label
                  ? `${stats.date_from_label} – ${stats.date_to_label}`
                  : "Noch kein Zeitraum."}
              </p>
              {stats.longest_day_label ? (
                <p className="text-sm leading-snug">
                  Längster Tag:{" "}
                  <strong>{stats.longest_day_label}</strong> mit{" "}
                  {stats.longest_day_count} Aufnahmen.
                </p>
              ) : null}
            </section>

            <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card ring-1 ring-border">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                <Sun className="size-5 text-amber-500" aria-hidden />
                Wetter
              </p>
              {stats.temp_min_c != null && stats.temp_max_c != null ? (
                <p className="text-3xl font-semibold tabular-nums leading-none">
                  {stats.temp_min_c}–{stats.temp_max_c} °C
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-snug">
                  Noch kein Wetter — Fotos mit Ort und Aufnahmezeit nachtragen.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {stats.weather.map((item) => (
                  <span key={item.code} className="inline-flex items-center gap-1">
                    <WeatherChip code={item.code} tempC={null} />
                    <span className="text-sm">
                      {item.label} · {item.count}
                    </span>
                  </span>
                ))}
              </div>
              {mode === "teilnehmer" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void backfillWeather()}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
                >
                  <CloudSun className="size-4" aria-hidden />
                  Wetter für bestehende Fotos holen
                </button>
              ) : null}
              {status ? (
                <p className="text-sm text-muted-foreground">{status}</p>
              ) : null}
            </section>

            <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card ring-1 ring-border">
              <p className="text-base font-semibold">Wer hat wie viel geteilt</p>
              <ul className="space-y-2">
                {stats.people.map((person) => (
                  <li
                    key={person.user_id}
                    className="flex items-center justify-between gap-3 rounded-2xl glass-fill px-3 py-2"
                  >
                    <span className="min-w-0 break-words font-medium">
                      {person.name}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {person.photo_count} Foto
                      {person.photo_count === 1 ? "" : "s"}
                      {person.video_count
                        ? ` · ${person.video_count} Video${person.video_count === 1 ? "" : "s"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {stats.places.length > 0 ? (
              <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card ring-1 ring-border">
                <p className="inline-flex items-center gap-2 text-base font-semibold">
                  <MapPin className="size-4" aria-hidden />
                  Orte
                </p>
                <p className="text-sm leading-snug break-words">
                  {stats.places.join(" · ")}
                </p>
              </section>
            ) : null}
          </>
        )}
      </main>
      <FloatingDock mode={mode} shareKey={shareKey} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl glass-fill px-3 py-3">
      <p className="text-3xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
