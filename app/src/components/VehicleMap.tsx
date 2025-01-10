import maplibre from "maplibre-gl";
import React, { useEffect, useState } from "react";
import { z } from "zod";

interface VehicleObservation {
  vehicleId: string;
  timestamp: string;
  lat: number;
  lon: number;
  tripId: string | null;
  routeId: string | null;
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

function filterOnlyRailbusesAndNotInService(
  vehicles: VehicleObservation[]
): VehicleObservation[] {
  return vehicles
    .filter((vehicle) => {
      if (vehicle.routeId === null) return true; // Keep vehicles with a null routeId
      const routeId = parseInt(vehicle.routeId, 10);
      return Object.values(RailbusRoutes).some(
        (range) => routeId >= range.start && routeId <= range.end
      );
    })
    .map((vehicle) => {
      if (vehicle.routeId === null) return vehicle; // No change for vehicles with a null routeId
      const routeId = parseInt(vehicle.routeId, 10);
      for (const [railLineName, range] of Object.entries(RailbusRoutes)) {
        if (routeId >= range.start && routeId <= range.end) {
          return { ...vehicle, routeId: railLineName };
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
        const filteredVehicles =
          filterOnlyRailbusesAndNotInService(fetchedVehicles);
        console.log(`Fetched ${fetchedVehicles.length} vehicles`);
        console.log(`Filtered down to ${filteredVehicles.length} vehicles`);
        setVehicles(filteredVehicles);
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
        id: `${sourceId}-label`,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": [
            "concat",
            "Vehicle: ",
            ["get", "vehicleId"],
            "\nRoute: ",
            ["get", "routeId"],
            "\n Trip: ",
            ["get", "tripId"],
          ],
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-radial-offset": 0.5,
          "text-justify": "auto",
          "text-size": 12,
        },
        paint: {
          "text-color": "#000000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
        filter: ["!=", ["get", "routeId"], ""],
      });

      mapRef.current.addLayer({
        id: sourceId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": ["case", ["!=", ["get", "routeId"], ""], 6, 3],
          "circle-color": [
            "match",
            ["get", "routeId"],
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
            "#808080", // Default to grey if routeId is null
          ],
          "circle-opacity": 0.8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.5,
        },
      });
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
};
