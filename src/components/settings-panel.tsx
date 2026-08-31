"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookImage, MapPin, Users } from "lucide-react";
import { MapStylePicker } from "@/components/map-style-picker";
import { InstallButton } from "@/components/pwa/install-button";
import { api } from "@/lib/api";
import {
  isGeotaggingEnabled,
  setGeotaggingEnabled,
  subscribeGeotagging,
} from "@/lib/geotag";
import type { Profile } from "@/lib/types";

export function SettingsPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState("#0f766e");
  const [status, setStatus] = useState<string | null>(null);
  const [geotag, setGeotag] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await api<{ profile: Profile }>("/api/profile");
      setProfile(data.profile);
      setDisplayName(data.profile.display_name);
      setAccent(data.profile.accent_color);
    };
    void load();
    setGeotag(isGeotaggingEnabled());
    return subscribeGeotagging(setGeotag);
  }, []);

  async function saveProfile() {
    if (!profile) return;
    try {
      const data = await api<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName.trim(),
          accent_color: accent,
        }),
      });
      setProfile(data.profile);
      setStatus("Profil gespeichert.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {profile?.role === "admin" ? (
        <section className="space-y-3">
          <h2 className="px-1 text-base font-semibold">Verwaltung</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/settings/users"
              className="flex min-h-11 flex-col justify-center gap-1 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
            >
              <span className="inline-flex items-center gap-2 text-base font-semibold">
                <Users className="size-4" aria-hidden />
                Teilnehmer
              </span>
              <span className="text-sm text-muted-foreground leading-snug">
                Benutzer anlegen, Passwort setzen, Konten bearbeiten.
              </span>
            </Link>
            <Link
              href="/settings/albums"
              className="flex min-h-11 flex-col justify-center gap-1 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
            >
              <span className="inline-flex items-center gap-2 text-base font-semibold">
                <BookImage className="size-4" aria-hidden />
                Alben
              </span>
              <span className="text-sm text-muted-foreground leading-snug">
                Alben anlegen, Teilnehmer zuordnen, Gäste-Links teilen.
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      {profile?.role === "admin" ? <MapStylePicker /> : null}

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="text-base font-semibold">Profil</h2>
        {profile?.email ? (
          <p className="break-all text-sm text-muted-foreground">{profile.email}</p>
        ) : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Anzeigename</span>
          <input
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Kartenfarbe</span>
          <input
            type="color"
            className="h-11 w-full rounded-2xl border border-border bg-background px-3"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveProfile()}
          className="inline-flex h-11 items-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Speichern
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="text-base font-semibold">Standort</h2>
        <button
          type="button"
          role="switch"
          aria-checked={geotag}
          onClick={() => {
            const next = !geotag;
            setGeotaggingEnabled(next);
            setGeotag(next);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-background px-3 py-3 text-left ring-1 ring-border"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium leading-snug">
              <MapPin className="size-4 shrink-0" aria-hidden />
              Geotagging
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground leading-snug">
              {geotag
                ? "Neue Fotos bekommen EXIF-GPS oder den aktuellen Standort."
                : "Neue Fotos werden ohne Koordinaten gespeichert."}
            </span>
          </span>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              geotag ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-card shadow transition-transform ${
                geotag ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
        <p className="text-sm text-muted-foreground leading-snug">
          Am iPhone: Safari darf den Standort nutzen, und in Fotos muss der Ort
          für das Bild erlaubt sein. Die In-App-Kamera schreibt selbst kein GPS
          — Photobuddy holt den Standort dann vom Gerät.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="text-base font-semibold">App</h2>
        <InstallButton />
      </section>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-muted text-sm font-medium"
      >
        Abmelden
      </button>
    </div>
  );
}
