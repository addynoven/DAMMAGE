"use client";

import { useEffect, useRef } from "react";

interface Pin {
  lat: number;
  lng: number;
  type: "road" | "waste";
  id: string;
  count: number;
}

export default function DetectionMap({ pins }: { pins: Pin[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let aborted = false;

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (aborted || !mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      pins.forEach((pin) => {
        const color = pin.type === "road" ? "#3CFFD0" : "#f59e0b";
        const icon = L.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #000;box-shadow:0 0 6px ${color}66"></div>`,
          className: "",
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${pin.type.toUpperCase()}</b><br>${pin.count} detection${pin.count !== 1 ? "s" : ""}<br><a href="/history/${pin.id}" style="color:#3CFFD0">View scan →</a>`);
      });

      if (pins.length === 1) {
        map.setView([pins[0].lat, pins[0].lng], 13);
      } else {
        const lats = pins.map((p) => p.lat);
        const lngs = pins.map((p) => p.lng);
        map.fitBounds(
          L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]),
          { padding: [30, 30] }
        );
      }
    });

    return () => {
      aborted = true;
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
      }
    };
  // pins is stable after first fetch — initialize once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        height: "400px",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
      }}
    />
  );
}
