"use client";

import dynamic from "next/dynamic";

const PhotoLocationMap = dynamic(() => import("@/components/photo-location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-card">
      <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
    </div>
  ),
});

export function PhotoLocationMapDynamic(props: {
  latitude: number;
  longitude: number;
  locationName: string | null;
  accentColor?: string;
}) {
  return <PhotoLocationMap {...props} />;
}
