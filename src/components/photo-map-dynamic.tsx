"use client";

import dynamic from "next/dynamic";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

const PhotoMap = dynamic(() => import("@/components/photo-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(70vh,36rem)] items-center justify-center rounded-2xl bg-card shadow-card ring-1 ring-border">
      <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
    </div>
  ),
});

export function PhotoMapDynamic(props: {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
}) {
  return <PhotoMap {...props} />;
}
