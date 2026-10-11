"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "@/app/place";

setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

interface PlaceMapProps {
  bbox: Place["bbox"];
  center: Place["center"];
  label: string;
  mapStyleUrl: string;
}

const centerFallbackZoom = 11;

export function PlaceMap({ bbox, center, label, mapStyleUrl }: PlaceMapProps) {
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
      ...(bbox
        ? {
            bounds: [
              [bbox.west, bbox.south],
              [bbox.east, bbox.north],
            ] as [[number, number], [number, number]],
            fitBoundsOptions: {
              maxZoom: 14,
              padding: 48,
            },
          }
        : {
            center: [center.longitude, center.latitude],
            zoom: centerFallbackZoom,
          }),
    });
    const marker = new Marker({ color: "#047857" })
      .setLngLat([center.longitude, center.latitude])
      .addTo(map);

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
      marker.remove();
      map.remove();
      mapRef.current = null;
      throw error;
    }

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [bbox, center, mapStyleUrl]);

  return (
    <div
      aria-label={`Interactive map of ${label}`}
      className="h-112 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
      ref={containerRef}
      role="region"
    />
  );
}
