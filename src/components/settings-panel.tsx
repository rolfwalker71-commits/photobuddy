"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus } from "lucide-react";
import { InstallButton } from "@/components/pwa/install-button";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";
import type { Profile, ShareLink } from "@/lib/types";

export function SettingsPanel() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState("#0f766e");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();
      if (data) {
        setProfile(data as Profile);
        setDisplayName(data.display_name);
        setAccent(data.accent_color);
      }
      const { data: share } = await supabase
        .from("share_links")
        .select("*")
        .order("created_at", { ascending: false });
      setLinks((share ?? []) as ShareLink[]);
    };
    void load();
  }, [supabase]);

  async function saveProfile() {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), accent_color: accent })
      .eq("id", profile.id);
    setStatus(error ? error.message : "Profil gespeichert.");
  }

  async function createLink() {
    const key = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("share_links")
      .insert({
        key,
        label: "Familien-Link",
        created_by: userData.user?.id,
      })
      .select("*")
      .single();
    if (error) {
      setStatus(error.message);
      return;
    }
    setLinks((prev) => [data as ShareLink, ...prev]);
  }

  async function toggleLink(link: ShareLink) {
    const { error } = await supabase
      .from("share_links")
      .update({ is_active: !link.is_active })
      .eq("id", link.id);
    if (!error) {
      setLinks((prev) =>
        prev.map((item) =>
          item.id === link.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const site = getSiteUrl();

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <h2 className="font-display text-base font-semibold">Profil</h2>
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Gäste-Links</h2>
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
        <h2 className="font-display text-base font-semibold">App</h2>
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
