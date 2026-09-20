"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Route } from "lucide-react";
import { BasemapLayer } from "@/components/basemap-layer";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { groupPhotosByDay, photoDayKey } from "@/lib/chapters";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { buildDayBridges, buildDayRoutes, formatKm } from "@/lib/route";
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
      // A pin stands 54px above its coordinate, so the top needs more room.
      paddingTopLeft: [30, 62],
      paddingBottomRight: [30, 18],
      maxZoom: 16,
    });
    // key captures the coordinate set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

/** Uploader colour and preview URL end up in markup, so quote them safely. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The marker is the photo itself: a thumbnail in the uploader's colour with a
 * tail pointing at the spot. Markers may overlap — the white ring keeps a stack
 * readable and `riseOnHover` lifts the one under the pointer.
 */
function photoPinIcon(src: string, color: string, isVideo: boolean) {
  const pin = escapeHtml(color);
  const inner = src
    ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="photo-pin__blank" style="background:${pin}"></span>`;
  const play = isVideo ? '<span class="photo-pin__play" aria-hidden></span>' : "";
  return L.divIcon({
    className: "photo-pin",
    html:
      `<span class="photo-pin__frame" style="border-color:${pin}">${inner}${play}</span>` +
      `<span class="photo-pin__tail" style="border-top-color:${pin}"></span>`,
    iconSize: [46, 54],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50],
  });
}

/** Below this a segment is too short on screen to carry a readable arrow. */
const MIN_ARROW_PX = 46;
/**
 * Web Mercator is conformal and scales uniformly, so a bearing never changes
 * with zoom — only the on-screen length does. Icons can therefore be reused.
 */
const arrowIcons = new Map<string, L.DivIcon>();

function arrowIcon(angle: number, color: string) {
  const key = `${angle}|${color}`;
  const cached = arrowIcons.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "route-arrow",
    html:
      `<span class="route-arrow__head" style="transform:rotate(${angle}deg);` +
      `border-bottom-color:${escapeHtml(color)}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  arrowIcons.set(key, icon);
  return icon;
}

type ArrowSegment = { key: string; points: [number, number][]; color: string };

type Arrow = {
  key: string;
  position: [number, number];
  angle: number;
  color: string;
  length0: number;
};

/**
 * One arrow per segment, at its midpoint, pointing the way the day ran.
 * Segments too short to read at the current zoom are left bare, so a dense
 * cluster of photos does not turn into a smudge of arrowheads.
 */
function RouteArrows({ segments }: { segments: ArrowSegment[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: (event) => setZoom(event.target.getZoom()) });

  // Measured in the zoom-0 world, then scaled — no reprojection per zoom step.
  const candidates = useMemo(() => {
    const out: Arrow[] = [];
    for (const segment of segments) {
      for (let i = 1; i < segment.points.length; i += 1) {
        const from = map.project(segment.points[i - 1], 0);
        const to = map.project(segment.points[i], 0);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length0 = Math.hypot(dx, dy);
        if (length0 === 0) continue;
        // The line is straight in projected space, so the midpoint must be too.
        const mid = map.unproject(L.point((from.x + to.x) / 2, (from.y + to.y) / 2), 0);
        out.push({
          key: `${segment.key}-${i}`,
          position: [mid.lat, mid.lng],
          // Screen bearing: 0° is up, growing clockwise like CSS rotate().
          angle: Math.round((Math.atan2(dx, -dy) * 180) / Math.PI),
          color: segment.color,
          length0,
        });
      }
    }
    return out;
  }, [map, segments]);

  const scale = 2 ** zoom;
  return (
    <>
      {candidates
        .filter((arrow) => arrow.length0 * scale >= MIN_ARROW_PX)
        .map((arrow) => (
          <Marker
            key={arrow.key}
            position={arrow.position}
            icon={arrowIcon(arrow.angle, arrow.color)}
            interactive={false}
            keyboard={false}
            zIndexOffset={-1000}
          />
        ))}
    </>
  );
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
  const located = useMemo(() => photos.filter(isLocated), [photos]);
  /**
   * Leaflet replaces the marker DOM whenever the icon object changes, which
   * would refetch every thumbnail on each render. Keep one icon per preview.
   */
  const iconCache = useRef(new Map<string, L.DivIcon>());
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
  const drawnRoutes = useMemo(
    () => routes.filter((route) => route.points.length >= 2),
    [routes],
  );
  const bridges = useMemo(() => buildDayBridges(routes), [routes]);
  const totalKm = drawnRoutes.reduce((sum, route) => sum + route.distanceKm, 0);
  const bridgeKm = bridges.reduce((sum, bridge) => sum + bridge.distanceKm, 0);
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

  function pinFor(photo: LocatedPhoto, color: string) {
    const src = previewPhotoUrl(photo);
    const key = `${src}|${color}|${photo.kind}`;
    const cached = iconCache.current.get(key);
    if (cached) return cached;
    const icon = photoPinIcon(src, color, photo.kind === "video");
    iconCache.current.set(key, icon);
    return icon;
  }

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

  /**
   * A bridge touching the chosen day stays lit: it shows how that day was
   * reached and where it led.
   */
  const bridgeFaded = (bridge: { fromDay: string; toDay: string }) =>
    selectedDay !== null &&
    bridge.fromDay !== selectedDay &&
    bridge.toDay !== selectedDay;

  const arrowSegments = useMemo<ArrowSegment[]>(() => {
    if (!showRoute) return [];
    const segments: ArrowSegment[] = [];
    for (const route of drawnRoutes) {
      if (selectedDay !== null && route.day !== selectedDay) continue;
      segments.push({
        key: `day-${route.day}`,
        points: route.points,
        color: route.color,
      });
    }
    for (const bridge of bridges) {
      if (
        selectedDay !== null &&
        bridge.fromDay !== selectedDay &&
        bridge.toDay !== selectedDay
      ) {
        continue;
      }
      segments.push({
        key: `hop-${bridge.toDay}`,
        points: bridge.points,
        color: bridge.color,
      });
    }
    return segments;
  }, [bridges, drawnRoutes, selectedDay, showRoute]);

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
                ? "glass-accent glass-interactive text-primary-foreground"
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
        {showRoute
          ? bridges.map((bridge) => {
              const faded = bridgeFaded(bridge);
              return (
                <Polyline
                  key={`hop-${bridge.toDay}-${faded ? "f" : "a"}`}
                  positions={bridge.points}
                  pathOptions={{
                    color: bridge.color,
                    weight: 2,
                    opacity: faded ? 0.18 : 0.5,
                    dashArray: "2 8",
                    lineCap: "round",
                  }}
                />
              );
            })
          : null}
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
        <RouteArrows segments={arrowSegments} />
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
              icon={pinFor(photo, color)}
              riseOnHover
              title={[photo.title?.trim(), humanLocationName(photo.location_name), author]
                .filter(Boolean)
                .join(" · ")}
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
        drawnRoutes.length > 0 || bridges.length > 0 ? (
          <div className="space-y-2 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <p className="text-sm font-medium">Route</p>
              <p className="text-xs text-muted-foreground">
                ca. {formatKm(totalKm)} Luftlinie
                {bridgeKm > 0 ? ` · ${formatKm(bridgeKm)} zwischen den Tagen` : ""}
              </p>
            </div>
            {bridges.length > 0 ? (
              <p className="px-1 text-xs leading-snug text-muted-foreground">
                Gestrichelt: der Weg vom letzten Foto eines Tages zum ersten des
                nächsten. Die Pfeile zeigen die Richtung.
              </p>
            ) : null}
            {drawnRoutes.length > 0 ? (
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
            ) : null}
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
