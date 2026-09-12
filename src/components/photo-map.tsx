"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Route } from "lucide-react";
import { BasemapLayer } from "@/components/basemap-layer";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { groupPhotosByDay, photoDayKey } from "@/lib/chapters";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { buildDayRoutes, formatKm } from "@/lib/route";
import { previewPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoMapProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
  lastSeenAt?: string | null;
  viewerId?: string | null;
  focusDay?: string | null;
};

type LocatedPhoto = Photo & { latitude: number; longitude: number };

function isLocated(photo: Photo): photo is LocatedPhoto {
  return photo.latitude != null && photo.longitude != null;
}

const ROUTE_PREF_KEY = "photobuddy.map.showRoute";

function readRoutePref() {
  try {
    return window.localStorage.getItem(ROUTE_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeRoutePref(value: boolean) {
  try {
    window.localStorage.setItem(ROUTE_PREF_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
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
  lastSeenAt = null,
  viewerId = null,
  focusDay = null,
}: PhotoMapProps) {
  const located = photos.filter(isLocated);
  const chapters = useMemo(() => groupPhotosByDay(located), [located]);
  /** null = whole trip. */
  const [selectedDay, setSelectedDay] = useState<string | null>(
    focusDay && chapters.some((chapter) => chapter.day === focusDay)
      ? focusDay
      : null,
  );
  const [showRoute, setShowRoute] = useState(readRoutePref);

  useEffect(() => {
    if (focusDay && chapters.some((chapter) => chapter.day === focusDay)) {
      setSelectedDay(focusDay);
    }
  }, [chapters, focusDay]);

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

  const routes = useMemo(() => buildDayRoutes(located, photoDayKey), [located]);
  const routeByDay = useMemo(
    () => new Map(routes.map((route) => [route.day, route])),
    [routes],
  );
  const drawnRoutes = routes.filter((route) => route.points.length >= 2);
  const totalKm = drawnRoutes.reduce((sum, route) => sum + route.distanceKm, 0);
  const headingByDay = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.day, chapter.heading])),
    [chapters],
  );

  // Zoom to the chosen day; the whole trip otherwise.
  const fitPoints = useMemo<[number, number][]>(() => {
    if (!selectedDay) return points;
    const dayPoints = located
      .filter((photo) => photoDayKey(photo) === selectedDay)
      .map(
        (photo): [number, number] =>
          positions.get(photo.id) ?? [photo.latitude, photo.longitude],
      );
    return dayPoints.length > 0 ? dayPoints : points;
  }, [located, points, positions, selectedDay]);

  function toggleRoute() {
    setShowRoute((value) => {
      writeRoutePref(!value);
      return !value;
    });
  }

  // Selected day draws last so it sits on top of the faded others.
  const routeLayers = showRoute
    ? [...drawnRoutes].sort(
        (a, b) => Number(a.day === selectedDay) - Number(b.day === selectedDay),
      )
    : [];

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
    <div className="space-y-3">
      {chapters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex h-10 min-h-10 min-w-0 flex-1 overflow-x-auto rounded-full bg-muted p-0.5"
            role="tablist"
            aria-label="Tag wählen"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedDay === null}
              onClick={() => setSelectedDay(null)}
              className={`h-full min-h-0 shrink-0 self-stretch rounded-full px-3 text-xs font-medium leading-none ${
                selectedDay === null
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Ganze Reise
            </button>
            {chapters.map((chapter) => {
              const active = selectedDay === chapter.day;
              return (
                <button
                  key={chapter.day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDay(chapter.day)}
                  className={`h-full min-h-0 shrink-0 self-stretch rounded-full px-3 text-xs font-medium leading-none ${
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {showRoute && routeByDay.get(chapter.day) ? (
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: routeByDay.get(chapter.day)?.color }}
                        aria-hidden
                      />
                    ) : null}
                    {chapter.heading}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showRoute}
            onClick={toggleRoute}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
              showRoute
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <Route className="size-4" aria-hidden />
            Route
          </button>
        </div>
      ) : null}
    <div className="overflow-hidden rounded-2xl shadow-card ring-1 ring-border">
      <MapContainer
        center={center}
        zoom={located.length === 1 ? 13 : 10}
        className="z-0 h-[min(70vh,36rem)] w-full"
        scrollWheelZoom
      >
        <FitPhotoBounds points={fitPoints} />
        <BasemapLayer />
        {routeLayers.map((route) => {
          const faded = selectedDay !== null && route.day !== selectedDay;
          return (
            <Polyline
              key={`${route.day}-${faded ? "f" : "a"}`}
              positions={route.points}
              pathOptions={{
                color: route.color,
                weight: faded ? 3 : selectedDay ? 5 : 4,
                opacity: faded ? 0.25 : 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          );
        })}
        {routeLayers
          .filter((route) => selectedDay === null || route.day === selectedDay)
          .map((route) => (
            <CircleMarker
              key={`start-${route.day}`}
              center={route.points[0]}
              radius={5}
              pathOptions={{
                color: route.color,
                weight: 3,
                fillColor: "#ffffff",
                fillOpacity: 1,
              }}
            />
          ))}
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
                      lastSeenAt={lastSeenAt}
                      viewerId={viewerId}
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
      {showRoute ? (
        drawnRoutes.length > 0 ? (
          <div className="space-y-2 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <p className="text-sm font-medium">Route</p>
              <p className="text-xs text-muted-foreground">
                ca. {formatKm(totalKm)} Luftlinie
              </p>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {drawnRoutes.map((route) => {
                const active = selectedDay === route.day;
                return (
                  <li key={route.day}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(active ? null : route.day)}
                      aria-pressed={active}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${
                        active ? "bg-foreground text-background" : "bg-muted"
                      }`}
                    >
                      <span
                        className="h-1 w-4 shrink-0 rounded-full"
                        style={{ background: route.color }}
                        aria-hidden
                      />
                      {headingByDay.get(route.day) ?? route.day}
                      <span className={active ? "opacity-75" : "text-muted-foreground"}>
                        {formatKm(route.distanceKm)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="px-1 text-sm leading-snug text-muted-foreground">
            Für eine Route braucht es mindestens zwei Fotos mit Standort am selben Tag.
          </p>
        )
      ) : null}
    </div>
  );
}
