"use client";

import { useEffect, useRef } from "react";
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  maximumMapObservations,
  observationGeoJsonSchema,
  type SpeciesObservationGeoJson,
} from "@/app/species-observation-geojson";
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
const minimumObservationFetchZoom = 7;
const observationFetchDebounceMs = 300;
const emptyObservationFeatureCollection = {
  type: "FeatureCollection" as const,
  features: [],
};

interface SpeciesMapProps {
  apiBaseUrl: string;
  mapStyleUrl: string;
  observations?: SpeciesObservationGeoJson;
  speciesId: string;
}

export function SpeciesMap({
  apiBaseUrl,
  mapStyleUrl,
  observations,
  speciesId,
}: SpeciesMapProps) {
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
    let observationFetchTimeout: ReturnType<typeof setTimeout> | undefined;
    let activeObservationRequest: AbortController | null = null;
    let latestObservationRequestId = 0;
    const initialObservations =
      observations ?? emptyObservationFeatureCollection;

    const setObservationData = (
      data:
        SpeciesObservationGeoJson | typeof emptyObservationFeatureCollection,
    ) => {
      map.getSource<GeoJSONSource>(observationsSourceId)?.setData(data);
    };

    const invalidateObservationRequest = () => {
      latestObservationRequestId += 1;
      activeObservationRequest?.abort();
      activeObservationRequest = null;

      if (observationFetchTimeout !== undefined) {
        clearTimeout(observationFetchTimeout);
        observationFetchTimeout = undefined;
      }

      return latestObservationRequestId;
    };

    const fetchObservationsForCurrentBounds = async (requestId: number) => {
      const requestController = new AbortController();
      activeObservationRequest = requestController;

      try {
        const bounds = map.getBounds();
        const url = new URL(
          `/api/species/${speciesId}/observations`,
          apiBaseUrl,
        );

        url.searchParams.set(
          "bbox",
          [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ].join(","),
        );
        url.searchParams.set("limit", maximumMapObservations);

        const response = await fetch(url, {
          cache: "no-store",
          signal: requestController.signal,
        });

        if (!response.ok) {
          return;
        }

        const nextObservations = observationGeoJsonSchema.safeParse(
          await response.json(),
        );

        if (
          !nextObservations.success ||
          requestController.signal.aborted ||
          requestId !== latestObservationRequestId ||
          mapRef.current !== map ||
          map.getZoom() < minimumObservationFetchZoom
        ) {
          return;
        }

        setObservationData(nextObservations.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        // Loading and unavailable states are introduced in a later step.
      } finally {
        if (activeObservationRequest === requestController) {
          activeObservationRequest = null;
        }
      }
    };

    const handleMoveEnd = () => {
      const requestId = invalidateObservationRequest();

      if (map.getZoom() < minimumObservationFetchZoom) {
        setObservationData(initialObservations);
        return;
      }

      observationFetchTimeout = setTimeout(() => {
        observationFetchTimeout = undefined;
        void fetchObservationsForCurrentBounds(requestId);
      }, observationFetchDebounceMs);
    };

    const handleLoad = () => {
      map.addSource(observationsSourceId, {
        type: "geojson",
        data: initialObservations,
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
      map.on("moveend", handleMoveEnd);
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
      invalidateObservationRequest();
      map.off("load", handleLoad);
      map.off("moveend", handleMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, [apiBaseUrl, mapStyleUrl, observations, speciesId]);

  return (
    <div
      aria-label="Interactive map of Poland"
      className="h-112 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
      ref={containerRef}
      role="region"
    />
  );
}
