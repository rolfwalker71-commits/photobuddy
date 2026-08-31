"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DEFAULT_MAP_STYLE,
  getMapStyle,
  isMapStyleId,
  type MapStyle,
  type MapStyleId,
} from "@/lib/map-styles";

export function useMapStyle(): MapStyle {
  const [id, setId] = useState<MapStyleId>(DEFAULT_MAP_STYLE);

  useEffect(() => {
    let cancelled = false;
    api<{ map_style: string }>("/api/settings")
      .then((data) => {
        if (!cancelled && isMapStyleId(data.map_style)) {
          setId(data.map_style);
        }
      })
      .catch(() => {
        /* keep Voyager */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return getMapStyle(id);
}
