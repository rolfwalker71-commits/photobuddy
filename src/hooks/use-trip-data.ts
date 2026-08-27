"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, withKey } from "@/lib/api";
import type { Photo, PhotoTag, Profile, ViewerMode } from "@/lib/types";

export function useTripData(mode: ViewerMode, shareKey: string | null) {
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
      if (mode === "guest" && !shareKey) {
        setError("Ungültiger oder fehlender Gäste-Link.");
        setPhotos([]);
        setLoading(false);
        return;
      }
      const data = await api<{
        photos: Photo[];
        profiles: Profile[];
        tags: PhotoTag[];
        shareLabel: string | null;
      }>(withKey("/api/trip", shareKey));
      setPhotos(data.photos);
      setProfiles(data.profiles);
      setTags(data.tags);
      setShareLabel(data.shareLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [mode, shareKey]);

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
