"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { BasemapLayer } from "@/components/basemap-layer";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { previewPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoMapProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
};

type LocatedPhoto = Photo & { latitude: number; longitude: number };

function isLocated(photo: Photo): photo is LocatedPhoto {
  return photo.latitude != null && photo.longitude != null;
}

/** ~11 m — photos this close share a point and get a small spread. */
const SAME_PLACE = 5;

function markerPositions(photos: LocatedPhoto[]) {
  const groups = new Map<string, LocatedPhoto[]>();
  for (const photo of photos) {
    const key = `${photo.latitude.toFixed(SAME_PLACE)},${photo.longitude.toFixed(SAME_PLACE)}`;
    const list = groups.get(key) ?? [];
    list.push(photo);
    groups.set(key, list);
  }

  const positions = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      positions.set(group[0].id, [group[0].latitude, group[0].longitude]);
      continue;
    }
    const lat0 = group.reduce((sum, photo) => sum + photo.latitude, 0) / group.length;
    const lng0 = group.reduce((sum, photo) => sum + photo.longitude, 0) / group.length;
    const radius = 0.00022 * Math.sqrt(group.length);
    const cos = Math.cos((lat0 * Math.PI) / 180) || 1;
    group.forEach((photo, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      positions.set(photo.id, [
        lat0 + radius * Math.cos(angle),
        lng0 + (radius * Math.sin(angle)) / cos,
      ]);
    });
  }
  return positions;
}

function FitPhotoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), {
      padding: [36, 36],
      maxZoom: 16,
    });
    // key captures the coordinate set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function markerIcon(color: string) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${color}" stroke="white" stroke-width="2" d="M14 1c7 0 13 6 13 13 0 10-13 21-13 21S1 24 1 14C1 7 7 1 14 1z"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
  );
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${svg}`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

export default function PhotoMap({
  photos,
  profiles,
  mode,
  shareKey,
}: PhotoMapProps) {
  const located = photos.filter(isLocated);

  const positions = useMemo(() => markerPositions(located), [located]);
  const points = useMemo<[number, number][]>(
    () =>
      located.map(
        (photo) =>
          positions.get(photo.id) ?? [photo.latitude, photo.longitude],
      ),
    [located, positions],
  );

  const center = useMemo<[number, number]>(() => {
    if (points[0]) return points[0];
    return [48.2082, 16.3738];
  }, [points]);

  if (located.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Keine GPS-Daten</p>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          Fotos mit Standort erscheinen als Markierungen auf der Karte.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl shadow-card ring-1 ring-border">
      <MapContainer
        center={center}
        zoom={located.length === 1 ? 13 : 10}
        className="z-0 h-[min(70vh,36rem)] w-full"
        scrollWheelZoom
      >
        <FitPhotoBounds points={points} />
        <BasemapLayer />
        {located.map((photo) => {
          const color = profiles[photo.uploaded_by]?.accent_color ?? "#0f766e";
          const src = previewPhotoUrl(photo);
          const author =
            profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
          const position = positions.get(photo.id) ?? [
            photo.latitude,
            photo.longitude,
          ];
          return (
            <Marker
              key={photo.id}
              position={position}
              icon={markerIcon(color)}
            >
              <Popup>
                <Link
                  href={appHref(mode, shareKey, "photo", photo.id)}
                  className="block w-40"
                >
                  <div className="relative mb-2 overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={photo.title || `Foto von ${author}`}
                      className="h-24 w-full object-cover"
                    />
                    <PhotoImageOverlay
                      photo={photo}
                      authorName={author}
                      compact
                    />
                  </div>
                  {photo.title?.trim() ? (
                    <strong className="block text-sm leading-snug">
                      {photo.title}
                    </strong>
                  ) : null}
                  {humanLocationName(photo.location_name) ? (
                    <span className="text-xs">
                      {humanLocationName(photo.location_name)}
                    </span>
                  ) : null}
                </Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
