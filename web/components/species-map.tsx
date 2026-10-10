"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SpeciesObservationGeoJson } from "@/app/species-observations";
import { polandBoundingBox } from "@/lib/poland-bounds";

setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

const polandBounds: [[number, number], [number, number]] = [
  [polandBoundingBox.west, polandBoundingBox.south],
  [polandBoundingBox.east, polandBoundingBox.north],
];

const observationsSourceId = "species-observations";
const observationsLayerId = "species-observation-points";

interface SpeciesMapProps {
  mapStyleUrl: string;
  observations?: SpeciesObservationGeoJson;
}

export function SpeciesMap({ mapStyleUrl, observations }: SpeciesMapProps) {
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

    const handleLoad = () => {
      if (!observations) {
        return;
      }

      map.addSource(observationsSourceId, {
        type: "geojson",
        data: observations,
      });
      map.addLayer({
        id: observationsLayerId,
        type: "circle",
        source: observationsSourceId,
        paint: {
          "circle-color": "#047857",
          "circle-opacity": 0.85,
          "circle-radius": 5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
    };

    try {
      map.addControl(
        new NavigationControl({
          showCompass: false,
          showZoom: true,
        }),
        "top-right",
      );
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      map.on("load", handleLoad);
    } catch (error) {
      map.remove();
      mapRef.current = null;
      throw error;
    }

    return () => {
      map.off("load", handleLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyleUrl, observations]);

  return (
    <div
      aria-label="Interactive map of Poland"
      className="h-[28rem] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
      ref={containerRef}
      role="region"
    />
  );
}
