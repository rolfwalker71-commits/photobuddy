"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { useMapStyle } from "@/hooks/use-map-style";
import {
  DEFAULT_MAP_STYLE,
  getMapStyle,
  leafletTileProps,
  type MapStyle,
} from "@/lib/map-styles";

function ClampMaxZoom({ maxZoom }: { maxZoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);
  return null;
}

function resolveStyle(style: MapStyle | null | undefined): MapStyle {
  if (style?.url && Number.isFinite(style.maxZoom)) return style;
  return getMapStyle(DEFAULT_MAP_STYLE);
}

export function BasemapTiles({ style }: { style: MapStyle }) {
  const resolved = resolveStyle(style);
  const tiles = leafletTileProps(resolved);
  return (
    <>
      <ClampMaxZoom maxZoom={resolved.maxZoom} />
      <TileLayer key={resolved.id} {...tiles} />
    </>
  );
}

export function BasemapLayer() {
  const style = useMapStyle();
  return <BasemapTiles style={style} />;
}
