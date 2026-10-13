"use client";

import { Layers, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "@/app/place";
import {
  protectedAreaCategorySchema,
  protectedAreasSchema,
  type ProtectedAreaCategory,
  type ProtectedAreas,
} from "@/app/protected-areas";
import {
  maximumListedSpecies,
  maximumMapObservations,
  spatialObservationsSchema,
  type SpatialObservations,
} from "@/app/spatial-observations";
import { Button } from "@/components/ui/button";

setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

interface PlaceMapProps {
  apiBaseUrl: string;
  bbox: Place["bbox"];
  center: Place["center"];
  label: string;
  mapStyleUrl: string;
}

const centerFallbackZoom = 11;
const observationFetchDebounceMs = 300;
const protectedAreaFetchDebounceMs = 300;
const observationsSourceId = "place-observations";
const observationClustersLayerId = "place-observation-clusters";
const observationClusterCountLayerId = "place-observation-cluster-count";
const unclusteredObservationsLayerId = "place-observation-points";
const protectedAreasSourceId = "place-protected-areas";
const protectedAreasFillLayerId = "place-protected-areas-fill";
const protectedAreasOutlineLayerId = "place-protected-areas-outline";
const renderedObservationSourcesSchema = z
  .array(
    z.object({
      provider: z.string(),
      url: z.url({ protocol: /^https?$/ }),
    }),
  )
  .min(1);
const renderedObservationFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }),
  properties: z.object({
    speciesId: z.string().regex(/^[1-9]\d*$/),
    speciesDisplayName: z.string().min(1),
    speciesScientificName: z.string().min(1),
    observedOn: z.string().nullable().optional(),
    observedAt: z.string().nullable().optional(),
    accuracyMeters: z.number().nonnegative().nullable().optional(),
    locationPrecision: z.enum(["approximate", "limited", "unknown"]),
    locationPrivacy: z.enum(["open", "obscured", "private", "unknown"]),
    sourcesJson: z.string(),
  }),
});
const renderedProtectedAreaFeatureSchema = z.object({
  properties: z.object({
    category: protectedAreaCategorySchema,
    inspireCode: z.string().min(1),
    name: z.string().min(1),
  }),
});

type ViewportRequestStatus = "loading" | "idle" | "error";
type ProtectedAreasRequestStatus = "inactive" | "loading" | "idle" | "error";
type RenderedObservation = z.infer<typeof renderedObservationFeatureSchema>;
type RenderedObservationSource = z.infer<
  typeof renderedObservationSourcesSchema
>[number];
type RenderedProtectedArea = z.infer<typeof renderedProtectedAreaFeatureSchema>;

export function PlaceMap({
  apiBaseUrl,
  bbox,
  center,
  label,
  mapStyleUrl,
}: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const retryViewportRequestRef = useRef<(() => void) | null>(null);
  const retryProtectedAreasRequestRef = useRef<(() => void) | null>(null);
  const toggleProtectedAreasRef = useRef<(() => void) | null>(null);
  const [observations, setObservations] = useState<SpatialObservations | null>(
    null,
  );
  const [viewportRequestStatus, setViewportRequestStatus] =
    useState<ViewportRequestStatus>("loading");
  const [protectedAreas, setProtectedAreas] = useState<ProtectedAreas | null>(
    null,
  );
  const [protectedAreasEnabled, setProtectedAreasEnabled] = useState(false);
  const [protectedAreasRequestStatus, setProtectedAreasRequestStatus] =
    useState<ProtectedAreasRequestStatus>("inactive");

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container,
      style: mapStyleUrl,
      renderWorldCopies: false,
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
    const observationPopup = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "20rem",
    });
    const protectedAreaPopup = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "20rem",
    });

    mapRef.current = map;
    let observationFetchTimeout: ReturnType<typeof setTimeout> | undefined;
    let activeObservationRequest: AbortController | null = null;
    let latestObservationRequestId = 0;
    let protectedAreaFetchTimeout: ReturnType<typeof setTimeout> | undefined;
    let activeProtectedAreaRequest: AbortController | null = null;
    let latestProtectedAreaRequestId = 0;
    let protectedAreasAreEnabled = false;

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

    const invalidateProtectedAreaRequest = () => {
      latestProtectedAreaRequestId += 1;
      activeProtectedAreaRequest?.abort();
      activeProtectedAreaRequest = null;

      if (protectedAreaFetchTimeout !== undefined) {
        clearTimeout(protectedAreaFetchTimeout);
        protectedAreaFetchTimeout = undefined;
      }

      return latestProtectedAreaRequestId;
    };

    const fetchObservationsForCurrentBounds = async (requestId: number) => {
      const requestController = new AbortController();
      activeObservationRequest = requestController;

      const isCurrentRequest = () =>
        !requestController.signal.aborted &&
        requestId === latestObservationRequestId &&
        mapRef.current === map;

      try {
        const bounds = map.getBounds();
        const url = new URL("/api/observations", apiBaseUrl);

        url.searchParams.set(
          "bbox",
          [
            clamp(bounds.getWest(), -180, 180),
            clamp(bounds.getSouth(), -90, 90),
            clamp(bounds.getEast(), -180, 180),
            clamp(bounds.getNorth(), -90, 90),
          ].join(","),
        );
        url.searchParams.set("limit", maximumMapObservations);
        url.searchParams.set("speciesLimit", maximumListedSpecies);

        const response = await fetch(url, {
          cache: "no-store",
          signal: requestController.signal,
        });

        if (!response.ok) {
          if (isCurrentRequest()) {
            setViewportRequestStatus("error");
          }

          return;
        }

        const nextObservations = spatialObservationsSchema.safeParse(
          await response.json(),
        );

        if (!nextObservations.success || !isCurrentRequest()) {
          if (!nextObservations.success && isCurrentRequest()) {
            setViewportRequestStatus("error");
          }

          return;
        }

        observationPopup.remove();
        map
          .getSource<GeoJSONSource>(observationsSourceId)
          ?.setData(toRenderedObservationData(nextObservations.data));
        setObservations(nextObservations.data);
        setViewportRequestStatus("idle");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (isCurrentRequest()) {
          setViewportRequestStatus("error");
        }
      } finally {
        if (activeObservationRequest === requestController) {
          activeObservationRequest = null;
        }
      }
    };

    const fetchProtectedAreasForCurrentBounds = async (requestId: number) => {
      const requestController = new AbortController();
      activeProtectedAreaRequest = requestController;

      const isCurrentRequest = () =>
        protectedAreasAreEnabled &&
        !requestController.signal.aborted &&
        requestId === latestProtectedAreaRequestId &&
        mapRef.current === map;

      try {
        const bounds = map.getBounds();
        const url = new URL("/api/protected-areas", apiBaseUrl);

        url.searchParams.set(
          "bbox",
          [
            clamp(bounds.getWest(), -180, 180),
            clamp(bounds.getSouth(), -90, 90),
            clamp(bounds.getEast(), -180, 180),
            clamp(bounds.getNorth(), -90, 90),
          ].join(","),
        );

        const response = await fetch(url, {
          cache: "no-store",
          signal: requestController.signal,
        });

        if (!response.ok) {
          if (isCurrentRequest()) {
            setProtectedAreasRequestStatus("error");
          }

          return;
        }

        const nextProtectedAreas = protectedAreasSchema.safeParse(
          await response.json(),
        );

        if (!nextProtectedAreas.success || !isCurrentRequest()) {
          if (!nextProtectedAreas.success && isCurrentRequest()) {
            setProtectedAreasRequestStatus("error");
          }

          return;
        }

        protectedAreaPopup.remove();
        map
          .getSource<GeoJSONSource>(protectedAreasSourceId)
          ?.setData(toRenderedProtectedAreaData(nextProtectedAreas.data));
        setProtectedAreas(nextProtectedAreas.data);
        setProtectedAreasRequestStatus("idle");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (isCurrentRequest()) {
          setProtectedAreasRequestStatus("error");
        }
      } finally {
        if (activeProtectedAreaRequest === requestController) {
          activeProtectedAreaRequest = null;
        }
      }
    };

    const requestCurrentViewport = (debounced: boolean) => {
      const requestId = invalidateObservationRequest();

      setViewportRequestStatus("loading");

      if (debounced) {
        observationFetchTimeout = setTimeout(() => {
          observationFetchTimeout = undefined;
          void fetchObservationsForCurrentBounds(requestId);
        }, observationFetchDebounceMs);
      } else {
        void fetchObservationsForCurrentBounds(requestId);
      }
    };

    const requestProtectedAreasForCurrentViewport = (debounced: boolean) => {
      const requestId = invalidateProtectedAreaRequest();

      setProtectedAreasRequestStatus("loading");

      if (debounced) {
        protectedAreaFetchTimeout = setTimeout(() => {
          protectedAreaFetchTimeout = undefined;
          void fetchProtectedAreasForCurrentBounds(requestId);
        }, protectedAreaFetchDebounceMs);
      } else {
        void fetchProtectedAreasForCurrentBounds(requestId);
      }
    };

    const handleMoveEnd = () => {
      requestCurrentViewport(true);

      if (protectedAreasAreEnabled) {
        requestProtectedAreasForCurrentViewport(true);
      }
    };
    const retryViewportRequest = () => requestCurrentViewport(false);
    const retryProtectedAreasRequest = () => {
      if (protectedAreasAreEnabled) {
        requestProtectedAreasForCurrentViewport(false);
      }
    };
    const toggleProtectedAreas = () => {
      if (
        !map.getLayer(protectedAreasFillLayerId) ||
        !map.getLayer(protectedAreasOutlineLayerId)
      ) {
        return;
      }

      protectedAreasAreEnabled = !protectedAreasAreEnabled;
      setProtectedAreasEnabled(protectedAreasAreEnabled);

      const visibility = protectedAreasAreEnabled ? "visible" : "none";

      map.setLayoutProperty(
        protectedAreasFillLayerId,
        "visibility",
        visibility,
      );
      map.setLayoutProperty(
        protectedAreasOutlineLayerId,
        "visibility",
        visibility,
      );

      if (protectedAreasAreEnabled) {
        requestProtectedAreasForCurrentViewport(false);
      } else {
        invalidateProtectedAreaRequest();
        protectedAreaPopup.remove();
        setProtectedAreasRequestStatus("inactive");
      }
    };

    retryViewportRequestRef.current = retryViewportRequest;
    retryProtectedAreasRequestRef.current = retryProtectedAreasRequest;
    toggleProtectedAreasRef.current = toggleProtectedAreas;

    const handleClusterClick = async (event: MapLayerMouseEvent) => {
      const cluster = event.features?.[0];
      const clusterId = cluster?.properties?.cluster_id;

      if (cluster?.geometry.type !== "Point" || typeof clusterId !== "number") {
        return;
      }

      try {
        const zoom = await map
          .getSource<GeoJSONSource>(observationsSourceId)
          ?.getClusterExpansionZoom(clusterId);

        if (zoom === undefined || mapRef.current !== map) {
          return;
        }

        map.easeTo({
          center: cluster.geometry.coordinates as [number, number],
          zoom,
        });
      } catch {
        // Ignore a cluster that changed while its expansion zoom was resolved.
      }
    };

    const handleObservationClick = (event: MapLayerMouseEvent) => {
      const observation = renderedObservationFeatureSchema.safeParse(
        event.features?.[0],
      );

      if (!observation.success) {
        return;
      }

      const sources = parseRenderedObservationSources(
        observation.data.properties.sourcesJson,
      );

      if (!sources) {
        return;
      }

      observationPopup
        .setLngLat(observation.data.geometry.coordinates)
        .setDOMContent(createObservationPopupContent(observation.data, sources))
        .addTo(map);
    };

    const handleProtectedAreaClick = (event: MapLayerMouseEvent) => {
      const protectedArea = renderedProtectedAreaFeatureSchema.safeParse(
        event.features?.[0],
      );

      if (!protectedArea.success) {
        return;
      }

      protectedAreaPopup
        .setLngLat(event.lngLat)
        .setDOMContent(createProtectedAreaPopupContent(protectedArea.data))
        .addTo(map);
    };

    const showPointerCursor = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const restoreMapCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleLoad = () => {
      map.addSource(protectedAreasSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: protectedAreasFillLayerId,
        type: "fill",
        source: protectedAreasSourceId,
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "match",
            ["get", "category"],
            "national-park",
            "#15803d",
            "nature-reserve",
            "#047857",
            "natura-2000-bird",
            "#0369a1",
            "natura-2000-habitat",
            "#0f766e",
            "landscape-park",
            "#65a30d",
            "#a16207",
          ],
          "fill-opacity": 0.2,
        },
      });
      map.addLayer({
        id: protectedAreasOutlineLayerId,
        type: "line",
        source: protectedAreasSourceId,
        layout: { visibility: "none" },
        paint: {
          "line-color": "#166534",
          "line-opacity": 0.85,
          "line-width": 1.5,
        },
      });
      map.addSource(observationsSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });
      map.addLayer({
        id: observationClustersLayerId,
        type: "circle",
        source: observationsSourceId,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#10b981",
            25,
            "#059669",
            100,
            "#047857",
          ],
          "circle-opacity": 0.9,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            25,
            21,
            100,
            27,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: observationClusterCountLayerId,
        type: "symbol",
        source: observationsSourceId,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: unclusteredObservationsLayerId,
        type: "circle",
        source: observationsSourceId,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#047857",
          "circle-opacity": 0.85,
          "circle-radius": 5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.on("click", observationClustersLayerId, handleClusterClick);
      map.on("click", unclusteredObservationsLayerId, handleObservationClick);
      map.on("click", protectedAreasFillLayerId, handleProtectedAreaClick);
      map.on("mouseenter", observationClustersLayerId, showPointerCursor);
      map.on("mouseleave", observationClustersLayerId, restoreMapCursor);
      map.on("mouseenter", unclusteredObservationsLayerId, showPointerCursor);
      map.on("mouseleave", unclusteredObservationsLayerId, restoreMapCursor);
      map.on("mouseenter", protectedAreasFillLayerId, showPointerCursor);
      map.on("mouseleave", protectedAreasFillLayerId, restoreMapCursor);
      map.on("moveend", handleMoveEnd);
      requestCurrentViewport(false);
    };

    try {
      map.addControl(
        new NavigationControl({ showCompass: false, showZoom: true }),
        "top-right",
      );
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      map.on("load", handleLoad);
    } catch (error) {
      marker.remove();
      map.remove();
      mapRef.current = null;
      throw error;
    }

    return () => {
      invalidateObservationRequest();
      invalidateProtectedAreaRequest();
      retryViewportRequestRef.current = null;
      retryProtectedAreasRequestRef.current = null;
      toggleProtectedAreasRef.current = null;
      observationPopup.remove();
      protectedAreaPopup.remove();
      marker.remove();
      map.off("load", handleLoad);
      map.off("moveend", handleMoveEnd);
      map.off("click", observationClustersLayerId, handleClusterClick);
      map.off("click", unclusteredObservationsLayerId, handleObservationClick);
      map.off("click", protectedAreasFillLayerId, handleProtectedAreaClick);
      map.off("mouseenter", observationClustersLayerId, showPointerCursor);
      map.off("mouseleave", observationClustersLayerId, restoreMapCursor);
      map.off("mouseenter", unclusteredObservationsLayerId, showPointerCursor);
      map.off("mouseleave", unclusteredObservationsLayerId, restoreMapCursor);
      map.off("mouseenter", protectedAreasFillLayerId, showPointerCursor);
      map.off("mouseleave", protectedAreasFillLayerId, restoreMapCursor);
      map.remove();
      mapRef.current = null;
    };
  }, [apiBaseUrl, bbox, center, mapStyleUrl]);

  return (
    <div>
      <div className="relative">
        <div
          aria-label={`Interactive biodiversity map of ${label}`}
          className="h-112 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
          ref={containerRef}
          role="region"
        />
        <div className="pointer-events-none absolute top-3 left-3 z-10 grid max-w-80 gap-2">
          <Button
            aria-pressed={protectedAreasEnabled}
            className="pointer-events-auto w-fit bg-white/95 shadow-sm backdrop-blur-sm"
            onClick={() => toggleProtectedAreasRef.current?.()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Layers aria-hidden="true" />
            Protected areas {protectedAreasEnabled ? "on" : "off"}
          </Button>

          {protectedAreasEnabled ? (
            protectedAreasRequestStatus === "error" ? (
              <div
                className="pointer-events-auto rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
                role="alert"
              >
                <p>
                  We could not refresh protected areas for this view.
                  {protectedAreas
                    ? " The layer shows the last successfully loaded area."
                    : " Place details and observations remain available."}
                </p>
                <Button
                  className="mt-2"
                  onClick={() => retryProtectedAreasRequestRef.current?.()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  Retry protected areas
                </Button>
              </div>
            ) : protectedAreasRequestStatus === "loading" ? (
              <p
                className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm backdrop-blur-sm"
                role="status"
              >
                Loading protected areas for this view.
                {protectedAreas ? " Previous results remain visible." : ""}
              </p>
            ) : protectedAreasRequestStatus === "idle" &&
              protectedAreas?.metadata.returnedAreaCount === 0 ? (
              <p
                className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm backdrop-blur-sm"
                role="status"
              >
                No protected areas were returned for this view.
              </p>
            ) : null
          ) : null}

          {protectedAreasEnabled && protectedAreas?.metadata.truncated ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
              role="status"
            >
              Some protected areas are not shown because the last loaded view
              exceeded the map limit.
            </p>
          ) : null}

          {viewportRequestStatus === "error" ? (
            <div
              className="pointer-events-auto rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
              role="alert"
            >
              <p>
                We could not refresh observations for this area.
                {observations
                  ? " The map and list show the last successfully loaded area."
                  : " Place details remain available."}
              </p>
              <Button
                className="mt-2"
                onClick={() => retryViewportRequestRef.current?.()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" />
                Retry this area
              </Button>
            </div>
          ) : viewportRequestStatus === "loading" ? (
            <p
              className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm backdrop-blur-sm"
              role="status"
            >
              Loading locally synchronized observations for this area.
              {observations ? " Previous results remain visible." : ""}
            </p>
          ) : observations?.metadata.totalObservationCount === 0 ? (
            <p
              className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm backdrop-blur-sm"
              role="status"
            >
              No locally synchronized observations were found in this area.
            </p>
          ) : null}

          {viewportRequestStatus === "idle" &&
          observations?.metadata.truncated ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
              role="status"
            >
              The map shows the newest{" "}
              {formatCount(observations.metadata.returnedObservationCount)} of{" "}
              {formatCount(observations.metadata.totalObservationCount)}{" "}
              observations in this view. Cluster counts cover only the displayed
              subset.
            </p>
          ) : null}
        </div>
      </div>

      {protectedAreasEnabled ? (
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Protected areas data:{" "}
          <a
            className="underline underline-offset-2 hover:text-stone-800"
            href={
              protectedAreas?.metadata.sourceUrl ??
              "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych"
            }
            rel="noreferrer"
            target="_blank"
          >
            General Directorate for Environmental Protection (GDOŚ)
          </a>
          . Boundaries are simplified for display, are informational, and do not
          constitute a legally authoritative determination.
        </p>
      ) : null}

      {observations ? (
        <div className="mt-6 grid gap-6 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <div>
            <p className="text-sm font-medium text-stone-900">
              {formatCount(observations.metadata.totalObservationCount)} locally
              synchronized{" "}
              {pluralize(
                observations.metadata.totalObservationCount,
                "observation",
              )}{" "}
              across {formatCount(observations.species.totalCount)}{" "}
              {pluralize(observations.species.totalCount, "species")} in the{" "}
              {viewportRequestStatus === "idle"
                ? "current map view"
                : "last successfully loaded map view"}
              .
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              These records reflect only data already synchronized by Nature
              Lens. They show that a species has been observed in this area, not
              that the dataset is complete or that the species is currently
              present.
            </p>
          </div>

          {observations.species.items.length > 0 ? (
            <div>
              <h3 className="font-semibold text-stone-900">
                {observations.species.truncated
                  ? "Most observed species"
                  : "Species observed in this view"}
              </h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {observations.species.items.map((species) => (
                  <li key={species.id}>
                    <Link
                      className="flex h-full items-baseline justify-between gap-4 rounded-lg border border-stone-200 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/50"
                      href={`/species/${species.id}`}
                    >
                      <span>
                        <span className="font-medium text-stone-900">
                          {species.displayName}
                        </span>
                        {species.displayName !== species.scientificName ? (
                          <span className="mt-0.5 block text-xs italic text-stone-500">
                            {species.scientificName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm text-stone-600">
                        {formatCount(species.observationCount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {observations.species.truncated ? (
                <p className="mt-3 text-xs leading-relaxed text-stone-500">
                  Showing the top{" "}
                  {formatCount(observations.species.returnedCount)} of{" "}
                  {formatCount(observations.species.totalCount)} species, ranked
                  by observation count across the full{" "}
                  {viewportRequestStatus === "idle"
                    ? "current viewport"
                    : "last successfully loaded viewport"}
                  .
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toRenderedObservationData(data: SpatialObservations) {
  return {
    type: data.type,
    features: data.features.map(({ properties, ...feature }) => ({
      ...feature,
      properties: {
        speciesId: properties.species.id,
        speciesDisplayName: properties.species.displayName,
        speciesScientificName: properties.species.scientificName,
        observedOn: properties.observedOn,
        observedAt: properties.observedAt,
        accuracyMeters: properties.accuracyMeters,
        locationPrecision: properties.locationPrecision,
        locationPrivacy: properties.locationPrivacy,
        sourcesJson: JSON.stringify(
          properties.sources.map(({ provider, url }) => ({ provider, url })),
        ),
      },
    })),
  };
}

function toRenderedProtectedAreaData(data: ProtectedAreas) {
  return {
    type: data.type,
    features: data.features,
  };
}

function createProtectedAreaPopupContent(
  protectedArea: RenderedProtectedArea,
): HTMLDivElement {
  const content = document.createElement("div");
  const title = document.createElement("p");
  const category = document.createElement("p");
  const sourceCode = document.createElement("p");

  content.className = "w-64 pr-3 text-stone-900";
  title.className = "text-sm font-semibold text-emerald-900";
  title.textContent = protectedArea.properties.name;
  category.className = "mt-1 text-xs text-stone-600";
  category.textContent = formatProtectedAreaCategory(
    protectedArea.properties.category,
  );
  sourceCode.className = "mt-3 text-xs text-stone-500";
  sourceCode.textContent = `INSPIRE code: ${protectedArea.properties.inspireCode}`;
  content.append(title, category, sourceCode);

  return content;
}

function formatProtectedAreaCategory(category: ProtectedAreaCategory): string {
  const labels = {
    "documentation-site": "Documentation site",
    "ecological-site": "Ecological site",
    "landscape-park": "Landscape park",
    "landscape-nature-complex": "Landscape-nature complex",
    "national-park": "National park",
    "natural-monument-area": "Surface natural monument",
    "natura-2000-bird": "Natura 2000 bird protection area",
    "natura-2000-habitat": "Natura 2000 habitat protection area",
    "nature-reserve": "Nature reserve",
    "protected-landscape-area": "Protected landscape area",
  } satisfies Record<ProtectedAreaCategory, string>;

  return labels[category];
}

function parseRenderedObservationSources(
  value: string,
): RenderedObservationSource[] | null {
  try {
    const sources = renderedObservationSourcesSchema.safeParse(
      JSON.parse(value),
    );

    return sources.success ? sources.data : null;
  } catch {
    return null;
  }
}

function createObservationPopupContent(
  observation: RenderedObservation,
  sources: RenderedObservationSource[],
): HTMLDivElement {
  const { properties } = observation;
  const content = document.createElement("div");
  const titleLink = document.createElement("a");
  const scientificName = document.createElement("p");
  const details = document.createElement("dl");

  content.className = "w-64 pr-3 text-stone-900";
  titleLink.className =
    "text-sm font-semibold text-emerald-900 underline underline-offset-2";
  titleLink.href = `/species/${properties.speciesId}`;
  titleLink.textContent = properties.speciesDisplayName;
  scientificName.className = "mt-0.5 text-xs italic text-stone-500";
  scientificName.textContent = properties.speciesScientificName;
  details.className = "mt-3 grid gap-2.5";
  details.append(
    createDefinitionItem(
      "Observed",
      properties.observedOn ?? properties.observedAt ?? "Date unavailable",
    ),
    createDefinitionItem(
      "Location privacy",
      capitalize(properties.locationPrivacy),
    ),
    createDefinitionItem(
      "Location precision",
      capitalize(properties.locationPrecision),
    ),
  );

  if (properties.accuracyMeters != null) {
    details.append(
      createDefinitionItem(
        "Reported accuracy",
        `${properties.accuracyMeters.toLocaleString("en")} m`,
      ),
    );
  }

  const sourceItem = document.createElement("div");
  const sourceTerm = document.createElement("dt");
  const sourceDescription = document.createElement("dd");

  sourceTerm.className = "text-xs font-medium text-stone-500";
  sourceTerm.textContent = sources.length === 1 ? "Source" : "Sources";
  sourceDescription.className = "mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-sm";

  for (const source of sources) {
    const sourceLink = document.createElement("a");

    sourceLink.className =
      "font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-700";
    sourceLink.href = source.url;
    sourceLink.rel = "noopener noreferrer";
    sourceLink.target = "_blank";
    sourceLink.textContent = source.provider;
    sourceDescription.append(sourceLink);
  }

  sourceItem.append(sourceTerm, sourceDescription);
  details.append(sourceItem);
  content.append(titleLink, scientificName, details);

  const locationNotice = getLocationNotice(properties);

  if (locationNotice) {
    const notice = document.createElement("p");

    notice.className =
      "mt-3 rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900";
    notice.textContent = locationNotice;
    content.append(notice);
  }

  return content;
}

function createDefinitionItem(label: string, value: string): HTMLDivElement {
  const item = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.className = "text-xs font-medium text-stone-500";
  term.textContent = label;
  description.className = "mt-0.5 text-sm text-stone-800";
  description.textContent = value;
  item.append(term, description);

  return item;
}

function getLocationNotice(
  properties: RenderedObservation["properties"],
): string | undefined {
  if (
    properties.locationPrivacy === "obscured" ||
    properties.locationPrivacy === "private" ||
    properties.locationPrecision === "limited"
  ) {
    return "The source intentionally limits the precision of this location.";
  }

  if (properties.locationPrecision === "approximate") {
    return "This location is approximate.";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatCount(value: number): string {
  return value.toLocaleString("en");
}

function pluralize(value: number, singular: string): string {
  if (singular === "species") {
    return "species";
  }

  return value === 1 ? singular : `${singular}s`;
}
