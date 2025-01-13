import maplibre, { MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import React, { useEffect, useState } from "react";
import { z } from "zod";

interface VehicleObservation {
  vehicleId: string;
  timestamp: string;
  lat: number;
  lon: number;
  tripId: string | null;
  routeId: string | null;
  railbusRouteName: string | null;
  tripStartTime: string | null;
  currentPassengerCount: number | null;
  totalPassengerCount: number | null;
}

const RawVehicleObservationSchema = z.object({
  vehicleId: z.string(),
  locationDetails: z.object({
    simpleLocationDetails: z.object({
      timestamp: z.string().datetime(),
      lat: z.number().gte(-90).lte(90),
      lon: z.number().gte(-180).lte(180),
      bearing: z.number().nullable(),
      bearingAccuracy: z.number().nullable(),
      speed: z.number().nullable(),
      speedAccuracy: z.number().nullable(),
    }),
  }),
  tripDetails: z.object({
    tripId: z.string().nullable(),
    routeId: z.string().nullable(),
    blockId: z.string().nullable(),
    tripShortName: z.string().nullable(),
    routeShortName: z.string().nullable(),
    tripStartTime: z.string().nullable(),
    currentPassengerCount: z.number().nullable(),
    totalPassengerCount: z.number().nullable(),
  }),
});

function parseVehicleObservation(
  raw: z.infer<typeof RawVehicleObservationSchema>
): VehicleObservation {
  return {
    vehicleId: raw.vehicleId.slice(5),
    timestamp: raw.locationDetails.simpleLocationDetails.timestamp,
    lat: raw.locationDetails.simpleLocationDetails.lat,
    lon: raw.locationDetails.simpleLocationDetails.lon,
    tripId: raw.tripDetails.tripId,
    routeId: raw.tripDetails.routeId,
    railbusRouteName: null,
    tripStartTime: raw.tripDetails.tripStartTime,
    currentPassengerCount: raw.tripDetails.currentPassengerCount,
    totalPassengerCount: raw.tripDetails.totalPassengerCount,
  };
}

async function fetchVehicles(): Promise<VehicleObservation[]> {
  const response = await fetch(import.meta.env.VITE_SNAPPER_API_URL, {
    headers: {
      "x-api-key": import.meta.env.VITE_SNAPPER_API_KEY,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();
  const parsedData = z
    .array(RawVehicleObservationSchema)
    .parse(data)
    .map((rawObservation) => parseVehicleObservation(rawObservation));
  return parsedData;
}

const RailbusRoutes: {
  [key: string]: { start: number; end: number; colour: string };
} = {
  KPL: { start: 23, end: 29, colour: "#d4d110" },
  MEL: { start: 33, end: 39, colour: "#ffab2f" },
  WRL: { start: 43, end: 49, colour: "#feca0a" },
  HVL: { start: 53, end: 59, colour: "#ffab2f" },
  JVL: { start: 63, end: 69, colour: "#42c3dc" },
};

function addRailbusRouteName(
  vehicles: VehicleObservation[]
): VehicleObservation[] {
  return vehicles.map((vehicle) => {
    if (vehicle.routeId === null) return vehicle;
    const routeId = parseInt(vehicle.routeId, 10);
    for (const [railLineName, range] of Object.entries(RailbusRoutes)) {
      if (routeId >= range.start && routeId <= range.end) {
        return { ...vehicle, railbusRouteName: railLineName };
      }
    }
    return vehicle;
  });
}

export default function VehicleMap() {
  const [vehicles, setVehicles] = useState<VehicleObservation[]>([]);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const pollRate = 5000;

  useEffect(() => {
    const updateVehicles = async () => {
      try {
        const fetchedVehicles = await fetchVehicles();
        console.log(`Fetched ${fetchedVehicles.length} vehicles`);
        const processedVehicles = addRailbusRouteName(fetchedVehicles);
        setVehicles(processedVehicles);
      } catch (error) {
        console.error("Error fetching bus data:", error);
      }
    };

    updateVehicles();
    const intervalId = setInterval(updateVehicles, pollRate);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!document.getElementById("map")) return;

    mapRef.current = new maplibre.Map({
      container: "map",
      style: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
      center: [174.85, -41.25],
      zoom: 11,
      attributionControl: false,
      maxBounds: [174.45, -41.7, 176.5, -40.7], // [west, south, east, north]
      minZoom: 9,
    });

    mapRef.current.on("load", () => {
      if (!mapRef.current) {
        return;
      }
      const sourceId = "vehicle-locations";

      mapRef.current.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      mapRef.current.addLayer({
        id: "notinservicePoints",
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 5,
          "circle-color": "#808080",
          "circle-opacity": 0.8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.5,
        },
        filter: ["==", ["get", "routeId"], ""],
      });

      mapRef.current.addLayer({
        id: "railbusPoints",
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 10,
          "circle-color": [
            "match",
            ["get", "railbusRouteName"],
            "KPL",
            RailbusRoutes.KPL.colour,
            "MEL",
            RailbusRoutes.MEL.colour,
            "WRL",
            RailbusRoutes.WRL.colour,
            "HVL",
            RailbusRoutes.HVL.colour,
            "JVL",
            RailbusRoutes.JVL.colour,
            "#FF0000",
          ],
          "circle-opacity": 0.8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.5,
        },
        filter: ["!=", ["get", "railbusRouteName"], ""],
      });

      mapRef.current.addLayer({
        id: "railbusLabels",
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": [
            "format",
            ["get", "railbusRouteName"],
            { "text-font": ["literal", ["Stadia Bold"]] },
            ", Trip ID: ",
            { "text-font": ["literal", ["Stadia Regular"]] },
            ["get", "tripId"],
            { "text-font": ["literal", ["Stadia Regular"]] },
            ", Vehicle ID: ",
            { "text-font": ["literal", ["Stadia Regular"]] },
            ["get", "vehicleId"],
            { "text-font": ["literal", ["Stadia Regular"]] },
          ],
          "text-anchor": "left",
          "text-radial-offset": 1,
          "text-justify": "left",
          "text-size": 14,
        },
        paint: {
          "text-color": "#000000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
        filter: ["!=", ["get", "railbusRouteName"], ""],
      });
    });

    mapRef.current.on(
      "click",
      "notinservicePoints",
      (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (!mapRef.current || !e.features || e.features.length === 0) return;

        const feat = e.features[0];
        const geom = feat.geometry;

        if (geom.type !== "Point") return;

        new maplibre.Popup()
          .setLngLat(geom.coordinates as [number, number])
          .setHTML(`Vehicle ID: ${feat.properties?.vehicleId}`)
          .addTo(mapRef.current);
      }
    );

    // Change the cursor to a pointer when the mouse is over the places layer.
    mapRef.current.on("mouseenter", "notinservicePoints", () => {
      if (!mapRef.current) {
        return;
      }
      mapRef.current.getCanvas().style.cursor = "pointer";
    });

    // Change it back to a pointer when it leaves.
    mapRef.current.on("mouseleave", "notinservicePoints", () => {
      if (!mapRef.current) {
        return;
      }
      mapRef.current.getCanvas().style.cursor = "";
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    const sourceId = "vehicle-locations";

    if (!mapRef.current || !mapRef.current.getSource(sourceId)) return;

    const geoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: vehicles.map((vehicle) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [vehicle.lon, vehicle.lat],
        },
        properties: {
          vehicleId: vehicle.vehicleId,
          tripId: vehicle.tripId,
          routeId: vehicle.routeId || "",
          railbusRouteName: vehicle.railbusRouteName || "",
          currentPassengerCount: vehicle.currentPassengerCount || "",
          totalPassengerCount: vehicle.totalPassengerCount || "",
        },
      })),
    };
    const source = mapRef.current.getSource(
      sourceId
    ) as maplibregl.GeoJSONSource;
    source.setData(geoJsonData);
  }, [vehicles]);

  return <div id="map" />;
}
