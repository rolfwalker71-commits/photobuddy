"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Photo, PhotoTag, Profile, ViewerMode } from "@/lib/types";

export function useTripData(mode: ViewerMode, shareKey: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "guest") {
        if (!shareKey) {
          setError("Ungültiger oder fehlender Gäste-Link.");
          setPhotos([]);
          setLoading(false);
          return;
        }
        const { data: check, error: checkError } = await supabase.rpc(
          "guest_validate_share",
          { p_key: shareKey },
        );
        if (checkError) throw checkError;
        const row = Array.isArray(check) ? check[0] : check;
        if (!row?.valid) {
          setError("Dieser Gäste-Link ist ungültig oder abgelaufen.");
          setLoading(false);
          return;
        }
        setShareLabel(row.label ?? "Gäste-Galerie");

        const [photoRes, profileRes, tagRes] = await Promise.all([
          supabase.rpc("guest_list_photos", { p_key: shareKey }),
          supabase.rpc("guest_list_profiles", { p_key: shareKey }),
          supabase.rpc("guest_list_tags", { p_key: shareKey }),
        ]);
        if (photoRes.error) throw photoRes.error;
        if (profileRes.error) throw profileRes.error;
        if (tagRes.error) throw tagRes.error;
        setPhotos((photoRes.data ?? []) as Photo[]);
        setProfiles(
          ((profileRes.data ?? []) as Omit<Profile, "role" | "created_at" | "updated_at">[]).map(
            (p) => ({
              ...p,
              role: "teilnehmer" as const,
              created_at: "",
              updated_at: "",
            }),
          ),
        );
        setTags((tagRes.data ?? []) as PhotoTag[]);
      } else {
        const [photoRes, profileRes, tagRes] = await Promise.all([
          supabase
            .from("photos")
            .select("*")
            .order("taken_at", { ascending: false, nullsFirst: false }),
          supabase.from("profiles").select("*").order("display_name"),
          supabase
            .from("photo_tags")
            .select("photo_id, tag_id, tags(name)"),
        ]);
        if (photoRes.error) throw photoRes.error;
        if (profileRes.error) throw profileRes.error;
        if (tagRes.error) throw tagRes.error;
        setPhotos((photoRes.data ?? []) as Photo[]);
        setProfiles((profileRes.data ?? []) as Profile[]);
        setTags(
          ((tagRes.data ?? []) as { photo_id: string; tag_id: string; tags: { name: string } | { name: string }[] | null }[]).map(
            (row) => ({
              photo_id: row.photo_id,
              tag_id: row.tag_id,
              name: Array.isArray(row.tags)
                ? row.tags[0]?.name
                : row.tags?.name ?? "",
            }),
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [mode, shareKey, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const profileById = useMemo(() => {
    return Object.fromEntries(profiles.map((p) => [p.id, p]));
  }, [profiles]);

  return {
    photos,
    profiles,
    tags,
    profileById,
    loading,
    error,
    shareLabel,
    reload: load,
  };
}
