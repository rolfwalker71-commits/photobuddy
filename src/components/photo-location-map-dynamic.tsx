"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

const PhotoLocationMap = dynamic(() => import("@/components/photo-location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-card">
      <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
    </div>
  ),
});

class PhotoLocationMapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center bg-card">
          <p className="text-sm text-muted-foreground">Karte nicht verfügbar</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PhotoLocationMapDynamic(props: {
  latitude: number;
  longitude: number;
  locationName: string | null;
  accentColor?: string;
}) {
  return (
    <PhotoLocationMapBoundary>
      <PhotoLocationMap {...props} />
    </PhotoLocationMapBoundary>
  );
}
