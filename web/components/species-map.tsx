"use client";

import { useEffect, useRef, useState } from "react";
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
const emptyObservationFeatureCollection = {
  type: "FeatureCollection" as const,
  features: [],
};

const renderedObservationPropertiesSchema = observationGeoJsonPropertiesSchema
  .omit({ source: true })
  .extend({
    observedOn: observationGeoJsonPropertiesSchema.shape.observedOn.optional(),
    observedAt: observationGeoJsonPropertiesSchema.shape.observedAt.optional(),
    accuracyMeters:
      observationGeoJsonPropertiesSchema.shape.accuracyMeters.optional(),
    sourceProvider:
      observationGeoJsonPropertiesSchema.shape.source.shape.provider,
    sourceUrl: observationGeoJsonPropertiesSchema.shape.source.shape.url,
  });

const renderedObservationFeatureSchema = observationGeoJsonFeatureSchema.extend(
  {
    properties: renderedObservationPropertiesSchema,
  },
);

type ObservationProperties =
  SpeciesObservationGeoJson["features"][number]["properties"];

type RenderedObservationProperties = Omit<
  ObservationProperties,
  "accuracyMeters" | "observedAt" | "observedOn" | "source"
> & {
  accuracyMeters?: ObservationProperties["accuracyMeters"];
  observedAt?: ObservationProperties["observedAt"];
  observedOn?: ObservationProperties["observedOn"];
  sourceProvider: string;
  sourceUrl: string;
};

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
        sourceProvider: properties.source.provider,
        sourceUrl: properties.source.url,
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
): HTMLDivElement {
  const content = document.createElement("div");
  const title = document.createElement("h3");
  const details = document.createElement("dl");
  const sourceItem = document.createElement("div");
  const sourceTerm = document.createElement("dt");
  const sourceDescription = document.createElement("dd");
  const sourceLink = document.createElement("a");

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
  sourceTerm.textContent = "Source";
  sourceDescription.className = "mt-0.5 text-sm";
  sourceLink.className =
    "font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-700";
  sourceLink.href = properties.sourceUrl;
  sourceLink.rel = "noopener noreferrer";
  sourceLink.target = "_blank";
  sourceLink.textContent = capitalize(properties.sourceProvider);
  sourceDescription.append(sourceLink);
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
  const [isDataTruncated, setIsDataTruncated] = useState(
    observations?.metadata.truncated ?? false,
  );

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
    const observationPopup = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "20rem",
    });

    const setObservationData = (
      data:
        SpeciesObservationGeoJson | typeof emptyObservationFeatureCollection,
    ) => {
      observationPopup.remove();
      map
        .getSource<GeoJSONSource>(observationsSourceId)
        ?.setData(toRenderedObservationData(data));
      setIsDataTruncated("metadata" in data ? data.metadata.truncated : false);
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

      observationPopup
        .setLngLat(observation.data.geometry.coordinates)
        .setDOMContent(
          createObservationPopupContent(observation.data.properties),
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
      setIsDataTruncated(
        "metadata" in initialObservations
          ? initialObservations.metadata.truncated
          : false,
      );
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

  return (
    <div className="relative">
      <div
        aria-label="Interactive map of Poland"
        className="h-112 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
        ref={containerRef}
        role="region"
      />
      {isDataTruncated ? (
        <p
          className="absolute top-3 left-3 z-10 max-w-72 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm"
          role="status"
        >
          This view contains more locally synchronized observations than can be
          shown. Cluster counts include only the displayed subset. Zoom in to
          see a smaller area.
        </p>
      ) : null}
    </div>
  );
}
