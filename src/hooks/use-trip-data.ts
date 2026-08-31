"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, withKey } from "@/lib/api";
import {
  consumePhotosDirty,
  subscribePhotosChanged,
} from "@/lib/photos-sync";
import type { Album, Photo, PhotoTag, Profile, ViewerMode } from "@/lib/types";

const POLL_MS = 10_000;

export function useTripData(
  mode: ViewerMode,
  shareKey: string | null,
  albumId: string | null,
) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<string | null>(null);
  const stampRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (!opts?.silent) setLoading(true);
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
          stamp?: string;
          albums?: Album[];
          currentAlbum?: Album | null;
        }>(withKey("/api/trip", shareKey, mode === "guest" ? null : albumId), {
          cache: "no-store",
        });
        setPhotos(data.photos);
        setProfiles(data.profiles);
        setTags(data.tags);
        setShareLabel(data.shareLabel);
        setAlbums(data.albums ?? []);
        setCurrentAlbum(data.currentAlbum ?? null);
        stampRef.current = data.stamp ?? `${data.photos.length}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [mode, shareKey, albumId],
  );

  const checkStamp = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (mode === "guest" && !shareKey) return;
    try {
      const data = await api<{ stamp: string }>(
        withKey("/api/photos/updated", shareKey, mode === "guest" ? null : albumId),
        { cache: "no-store" },
      );
      if (stampRef.current == null) {
        stampRef.current = data.stamp;
        return;
      }
      if (data.stamp !== stampRef.current) {
        stampRef.current = data.stamp;
        await load({ silent: true });
      }
    } catch {
      /* keep the current list; next poll retries */
    }
  }, [load, mode, shareKey, albumId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshIfNeeded = () => {
      if (document.visibilityState !== "visible") return;
      if (consumePhotosDirty()) {
        void load({ silent: true });
        return;
      }
      void checkStamp();
    };

    const onVisible = () => refreshIfNeeded();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);

    const unsubscribe = subscribePhotosChanged(() => {
      void load({ silent: true });
    });

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkStamp();
    }, POLL_MS);

    if (consumePhotosDirty()) {
      void load({ silent: true });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [checkStamp, load]);

  const profileById = useMemo(() => {
    return Object.fromEntries(profiles.map((p) => [p.id, p]));
  }, [profiles]);

  return {
    photos,
    profiles,
    tags,
    albums,
    currentAlbum,
    profileById,
    loading,
    error,
    shareLabel,
    reload: load,
  };
}