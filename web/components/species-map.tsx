"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

const polandBounds: [[number, number], [number, number]] = [
  [14.12, 49],
  [24.15, 54.84],
];

interface SpeciesMapProps {
  mapStyleUrl: string;
}

export function SpeciesMap({ mapStyleUrl }: SpeciesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container,
      style: mapStyleUrl,
      bounds: polandBounds,
      fitBoundsOptions: {
        padding: 32,
      },
    });

    mapRef.current = map;

    try {
      map.addControl(
        new NavigationControl({
          showCompass: false,
          showZoom: true,
        }),
        "top-right",
      );
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    } catch (error) {
      map.remove();
      mapRef.current = null;
      throw error;
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyleUrl]);

  return (
    <div
      aria-label="Interactive map of Poland"
      className="h-[28rem] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
      ref={containerRef}
      role="region"
    />
  );
}
