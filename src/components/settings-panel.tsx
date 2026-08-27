"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MapPin, Plus, Users } from "lucide-react";
import { InstallButton } from "@/components/pwa/install-button";
import { api } from "@/lib/api";
import { getSiteUrl } from "@/lib/env";
import {
  isGeotaggingEnabled,
  setGeotaggingEnabled,
  subscribeGeotagging,
} from "@/lib/geotag";
import type { Profile, ShareLink } from "@/lib/types";

export function SettingsPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState("#0f766e");
  const [status, setStatus] = useState<string | null>(null);
  const [geotag, setGeotag] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await api<{ profile: Profile; shareLinks: ShareLink[] }>(
        "/api/profile",
      );
      setProfile(data.profile);
      setDisplayName(data.profile.display_name);
      setAccent(data.profile.accent_color);
      setLinks(data.shareLinks);
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

  async function createLink() {
    try {
      const data = await api<{ shareLink: ShareLink }>("/api/share-links", {
        method: "POST",
      });
      setLinks((prev) => [data.shareLink, ...prev]);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Link fehlgeschlagen.");
    }
  }

  async function toggleLink(link: ShareLink) {
    await api(`/api/share-links/${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !link.is_active }),
    });
    setLinks((prev) =>
      prev.map((item) =>
        item.id === link.id ? { ...item, is_active: !item.is_active } : item,
      ),
    );
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const site = getSiteUrl();

  return (
    <div className="space-y-6">
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

      {profile?.role === "admin" ? (
        <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          <h2 className="text-base font-semibold">Teilnehmer</h2>
          <p className="text-sm text-muted-foreground leading-snug">
            Reise-Teilnehmer anlegen, Passwort zurücksetzen oder Konten
            deaktivieren. Gäste bleiben ohne Login über den Link.
          </p>
          <Link
            href="/settings/users"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Users className="size-4" aria-hidden />
            Teilnehmer verwalten
          </Link>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Gäste-Links</h2>
          <button
            type="button"
            onClick={() => void createLink()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm font-medium"
          >
            <Plus className="size-4" />
            Neu
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          Freunde und Familie sehen Galerie, Karte und Timeline — ohne Login.
          Kommentare und Emojis sind erlaubt, Uploads nicht.
        </p>
        <ul className="space-y-2">
          {links.map((link) => {
            const href = `${site}/gallery/share?key=${encodeURIComponent(link.key)}`;
            return (
              <li
                key={link.id}
                className="rounded-2xl bg-background p-3 ring-1 ring-border"
              >
                <p className="text-sm font-medium break-words">{link.label}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {href}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm"
                    onClick={() => void navigator.clipboard.writeText(href)}
                  >
                    <Copy className="size-4" />
                    Kopieren
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm"
                    onClick={() => void toggleLink(link)}
                  >
                    {link.is_active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
