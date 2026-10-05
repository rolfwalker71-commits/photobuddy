"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BellRing, BookImage, ChevronRight, Smartphone, UserRound, HelpCircle, LayoutGrid, Map as MapIcon, MapPin, Trash2, Users } from "lucide-react";
import { AlbumGuestLinkPanel } from "@/components/album-guest-link-panel";
import { BackupPanel } from "@/components/backup-panel";
import { DigestSettings } from "@/components/digest-settings";
import { InstallButton } from "@/components/pwa/install-button";
import { PushEnable } from "@/components/push-enable";
import { api } from "@/lib/api";
import {
  isGeotaggingEnabled,
  setGeotaggingEnabled,
  subscribeGeotagging,
} from "@/lib/geotag";
import type { Profile } from "@/lib/types";

/** HSL triples, as the `--tile` custom property of `.icon-tile` expects. */
const TILE = {
  indigo: "236 90% 63%",
  teal: "175 87% 35%",
  orange: "29 95% 56%",
  pink: "335 88% 61%",
  purple: "267 78% 65%",
  red: "4 80% 58%",
  gray: "232 10% 52%",
} as const;

/** A settings row like in iOS Settings: coloured tile, title, hint, chevron. */
function SettingsRow({
  href,
  icon: Icon,
  tile,
  title,
  hint,
  id,
}: {
  href: string;
  icon: LucideIcon;
  tile: keyof typeof TILE;
  title: string;
  hint: string;
  id?: string;
}) {
  return (
    <Link
      href={href}
      id={id}
      className="glass-interactive flex min-h-11 scroll-mt-24 items-center gap-3 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border"
    >
      <span
        className="icon-tile size-10 rounded-xl"
        style={{ "--tile": TILE[tile] } as React.CSSProperties}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-snug">{title}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function SettingsPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState("#5B66F5");
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
      {!profile ? null : profile.role === "admin" ? (
        <section className="space-y-3">
          <h2 className="px-1 text-base font-semibold">Verwaltung</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsRow
              href="/settings/users"
              icon={Users}
              tile="indigo"
              title="Teilnehmer"
              hint="Benutzer anlegen, Passwort setzen, Konten bearbeiten."
            />
            <SettingsRow
              href="/settings/albums"
              icon={BookImage}
              tile="pink"
              title="Alben"
              hint="Alben anlegen, Teilnehmer zuordnen, Gäste-Links teilen."
            />
            <SettingsRow
              href="/settings/map"
              id="darstellung"
              icon={MapIcon}
              tile="teal"
              title="Darstellung"
              hint="Karte — Voyager, Satellit, Topo und weitere Stile."
            />
          </div>
          <DigestSettings />
          <BackupPanel />
        </section>
      ) : (
        <SettingsRow
          href="/settings/map"
          id="darstellung"
          icon={MapIcon}
          tile="teal"
          title="Darstellung"
          hint="Karte — aktueller Stil sichtbar. Wechseln können nur Admins."
        />
      )}

      <SettingsRow
        href="/settings/widgets"
        icon={LayoutGrid}
        tile="orange"
        title="Widgets"
        hint="Fotos auf dem Homescreen von iPhone und iPad — Skript für Scriptable."
      />
      <SettingsRow
        href="/settings/trash"
        icon={Trash2}
        tile="red"
        title="Papierkorb"
        hint="Gelöschte Fotos 30 Tage wiederherstellen."
      />
      <SettingsRow
        href="/settings/help"
        icon={HelpCircle}
        tile="purple"
        title="Hilfe"
        hint="Upload, Karte, Timeline, KI und Widgets kurz erklärt."
      />

      <AlbumGuestLinkPanel />

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="icon-tile" style={{ "--tile": TILE.indigo } as React.CSSProperties} aria-hidden>
            <UserRound className="size-4" />
          </span>
          Profil
        </h2>
        {profile?.email ? (
          <p className="break-all text-sm text-muted-foreground">{profile.email}</p>
        ) : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Anzeigename</span>
          <input
            className="h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Kartenfarbe</span>
          <input
            type="color"
            className="h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveProfile()}
          className="inline-flex h-11 items-center rounded-2xl glass-accent glass-interactive px-4 text-sm font-medium text-primary-foreground"
        >
          Speichern
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="icon-tile" style={{ "--tile": TILE.teal } as React.CSSProperties} aria-hidden>
            <MapPin className="size-4" />
          </span>
          Standort
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={geotag}
          onClick={() => {
            const next = !geotag;
            setGeotaggingEnabled(next);
            setGeotag(next);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl glass-fill px-3 py-3 text-left"
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
        <h2 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="icon-tile" style={{ "--tile": TILE.red } as React.CSSProperties} aria-hidden>
            <BellRing className="size-4" />
          </span>
          Benachrichtigungen
        </h2>
        <p className="text-sm text-muted-foreground leading-snug">
          Ein Tipp — neue Fotos und Kommentare kommen als Hinweis. Kein extra
          Konto, nur diese Erlaubnis. Fotos wahlweise sofort oder gesammelt am
          Abend.
        </p>
        <PushEnable mode="teilnehmer" shareKey={null} />
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="icon-tile" style={{ "--tile": TILE.gray } as React.CSSProperties} aria-hidden>
            <Smartphone className="size-4" />
          </span>
          App
        </h2>
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
