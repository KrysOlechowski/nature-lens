"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  maximumMapObservations,
  observationGeoJsonFeatureSchema,
  observationGeoJsonPropertiesSchema,
  observationGeoJsonSchema,
  type SpeciesObservationGeoJson,
} from "@/app/species-observation-geojson";
import { Button } from "@/components/ui/button";
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
const observationClustersLayerId = "species-observation-clusters";
const observationClusterCountLayerId = "species-observation-cluster-count";
const unclusteredObservationsLayerId = "species-observation-points";
const minimumObservationFetchZoom = 7;
const observationFetchDebounceMs = 300;
const renderedObservationSourcesSchema = z
  .array(
    z.object({
      provider: z.string(),
      url: z.url({ protocol: /^https?$/ }),
    }),
  )
  .min(1);

const renderedObservationPropertiesSchema = observationGeoJsonPropertiesSchema
  .omit({ sources: true })
  .extend({
    observedOn: observationGeoJsonPropertiesSchema.shape.observedOn.optional(),
    observedAt: observationGeoJsonPropertiesSchema.shape.observedAt.optional(),
    accuracyMeters:
      observationGeoJsonPropertiesSchema.shape.accuracyMeters.optional(),
    sourcesJson: z.string(),
  });

const renderedObservationFeatureSchema = observationGeoJsonFeatureSchema.extend(
  {
    properties: renderedObservationPropertiesSchema,
  },
);

type RenderedObservationProperties = z.infer<
  typeof renderedObservationPropertiesSchema
>;
type RenderedObservationSource = z.infer<
  typeof renderedObservationSourcesSchema
>[number];

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

function toRenderedObservationData(
  data: Pick<SpeciesObservationGeoJson, "type" | "features">,
) {
  return {
    type: data.type,
    features: data.features.map(({ properties, ...feature }) => ({
      ...feature,
      properties: {
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function createObservationPopupContent(
  properties: RenderedObservationProperties,
  sources: RenderedObservationSource[],
): HTMLDivElement {
  const content = document.createElement("div");
  const title = document.createElement("h3");
  const details = document.createElement("dl");
  const sourceItem = document.createElement("div");
  const sourceTerm = document.createElement("dt");
  const sourceDescription = document.createElement("dd");

  content.className = "w-64 pr-3 text-stone-900";
  title.className = "text-sm font-semibold";
  title.textContent = "Observation details";
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
  content.append(title, details);

  let locationNotice: string | undefined;

  if (
    properties.locationPrivacy === "obscured" ||
    properties.locationPrivacy === "private" ||
    properties.locationPrecision === "limited"
  ) {
    locationNotice =
      "The source intentionally limits the precision of this location.";
  } else if (properties.locationPrecision === "approximate") {
    locationNotice = "This location is approximate.";
  }

  if (locationNotice) {
    const notice = document.createElement("p");

    notice.className =
      "mt-3 rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900";
    notice.textContent = locationNotice;
    content.append(notice);
  }

  return content;
}

interface SpeciesMapProps {
  apiBaseUrl: string;
  mapStyleUrl: string;
  observations: SpeciesObservationGeoJson;
  speciesId: string;
}

type ViewportRequestStatus = "idle" | "loading" | "error";

export function SpeciesMap({
  apiBaseUrl,
  mapStyleUrl,
  observations,
  speciesId,
}: SpeciesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const retryViewportRequestRef = useRef<(() => void) | null>(null);
  const [isDataTruncated, setIsDataTruncated] = useState(
    observations.metadata.truncated,
  );
  const [displayedObservationCount, setDisplayedObservationCount] = useState(
    observations.features.length,
  );
  const [viewportRequestStatus, setViewportRequestStatus] =
    useState<ViewportRequestStatus>("idle");

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
    const initialObservations = observations;
    const observationPopup = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "20rem",
    });

    const setObservationData = (data: SpeciesObservationGeoJson) => {
      observationPopup.remove();
      map
        .getSource<GeoJSONSource>(observationsSourceId)
        ?.setData(toRenderedObservationData(data));
      setDisplayedObservationCount(data.features.length);
      setIsDataTruncated(data.metadata.truncated);
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

      const isCurrentRequest = () =>
        !requestController.signal.aborted &&
        requestId === latestObservationRequestId &&
        mapRef.current === map &&
        map.getZoom() >= minimumObservationFetchZoom;

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
          if (isCurrentRequest()) {
            setViewportRequestStatus("error");
          }

          return;
        }

        const nextObservations = observationGeoJsonSchema.safeParse(
          await response.json(),
        );

        if (!nextObservations.success || !isCurrentRequest()) {
          if (!nextObservations.success && isCurrentRequest()) {
            setViewportRequestStatus("error");
          }

          return;
        }

        setObservationData(nextObservations.data);
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

    const handleMoveEnd = () => {
      const requestId = invalidateObservationRequest();

      if (map.getZoom() < minimumObservationFetchZoom) {
        setObservationData(initialObservations);
        setViewportRequestStatus("idle");
        return;
      }

      setViewportRequestStatus("loading");
      observationFetchTimeout = setTimeout(() => {
        observationFetchTimeout = undefined;
        void fetchObservationsForCurrentBounds(requestId);
      }, observationFetchDebounceMs);
    };

    const retryViewportRequest = () => {
      const requestId = invalidateObservationRequest();

      if (map.getZoom() < minimumObservationFetchZoom) {
        setObservationData(initialObservations);
        setViewportRequestStatus("idle");
        return;
      }

      setViewportRequestStatus("loading");
      void fetchObservationsForCurrentBounds(requestId);
    };

    retryViewportRequestRef.current = retryViewportRequest;

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
        .setDOMContent(
          createObservationPopupContent(observation.data.properties, sources),
        )
        .addTo(map);
    };

    const showPointerCursor = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const restoreMapCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleLoad = () => {
      map.addSource(observationsSourceId, {
        type: "geojson",
        data: toRenderedObservationData(initialObservations),
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
        paint: {
          "text-color": "#ffffff",
        },
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
      setIsDataTruncated(initialObservations.metadata.truncated);
      setDisplayedObservationCount(initialObservations.features.length);
      setViewportRequestStatus("idle");
      map.on("click", observationClustersLayerId, handleClusterClick);
      map.on("click", unclusteredObservationsLayerId, handleObservationClick);
      map.on("mouseenter", observationClustersLayerId, showPointerCursor);
      map.on("mouseleave", observationClustersLayerId, restoreMapCursor);
      map.on("mouseenter", unclusteredObservationsLayerId, showPointerCursor);
      map.on("mouseleave", unclusteredObservationsLayerId, restoreMapCursor);
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
      retryViewportRequestRef.current = null;
      observationPopup.remove();
      map.off("load", handleLoad);
      map.off("moveend", handleMoveEnd);
      map.off("click", observationClustersLayerId, handleClusterClick);
      map.off("click", unclusteredObservationsLayerId, handleObservationClick);
      map.off("mouseenter", observationClustersLayerId, showPointerCursor);
      map.off("mouseleave", observationClustersLayerId, restoreMapCursor);
      map.off("mouseenter", unclusteredObservationsLayerId, showPointerCursor);
      map.off("mouseleave", unclusteredObservationsLayerId, restoreMapCursor);
      map.remove();
      mapRef.current = null;
    };
  }, [apiBaseUrl, mapStyleUrl, observations, speciesId]);

  const retryViewportRequest = () => {
    retryViewportRequestRef.current?.();
  };

  return (
    <div className="relative">
      <div
        aria-label="Interactive map of Poland"
        className="h-112 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
        ref={containerRef}
        role="region"
      />
      <div className="pointer-events-none absolute top-3 left-3 z-10 grid max-w-80 gap-2">
        {viewportRequestStatus === "error" ? (
          <div
            className="pointer-events-auto rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
            role="alert"
          >
            <p>
              We could not refresh observations for this area. The map is
              showing the last successfully loaded data.
            </p>
            <Button
              className="mt-2"
              onClick={retryViewportRequest}
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
            Loading observations for this area. The map remains available with
            the last loaded data.
          </p>
        ) : displayedObservationCount === 0 ? (
          <p
            className="rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs leading-relaxed text-stone-700 shadow-sm backdrop-blur-sm"
            role="status"
          >
            No locally synchronized observations were found in this area.
          </p>
        ) : null}

        {isDataTruncated ? (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
            role="status"
          >
            This view contains more locally synchronized observations than can
            be shown. Cluster counts include only the displayed subset. Zoom in
            to see a smaller area.
          </p>
        ) : null}
      </div>
    </div>
  );
}
