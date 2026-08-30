import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ItineraryDay } from "@/lib/types";
import { dayColor } from "@/lib/types";
import { placeSearchUrl } from "@/lib/gmaps";

interface MapViewProps {
  days: ItineraryDay[];
  /** null = show every day; otherwise the day number to focus. */
  activeDay: number | null;
  destination: string;
  className?: string;
}

function pinIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `
      <svg viewBox="0 0 30 40" width="30" height="40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/>
        <circle cx="15" cy="14.5" r="10" fill="white"/>
        <text x="15" y="19" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${color}">${label}</text>
      </svg>`,
  });
}

export default function MapView({
  days,
  activeDay,
  destination,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false, // don't hijack page scroll; pinch/dblclick still zoom
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const shown = days.filter((d) => activeDay === null || d.day === activeDay);
    const points: L.LatLngExpression[] = [];
    shown.forEach((day) => {
      const color = dayColor(day.day - 1);
      day.stops.forEach((stop, i) => {
        if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return;
        points.push([stop.lat, stop.lng]);
        const marker = L.marker([stop.lat, stop.lng], {
          icon: pinIcon(color, String(i + 1)),
          title: stop.name,
        });
        marker.bindPopup(
          `<div style="min-width:170px">
             <div style="font-weight:600">${stop.name}</div>
             <div style="color:#54646b;font-size:12px;margin:2px 0 6px">Day ${day.day} · ${stop.kind}</div>
             <a href="${placeSearchUrl(stop, destination)}" target="_blank" rel="noreferrer" style="color:#0f766e;font-weight:600;font-size:13px">Open in Google Maps ↗</a>
           </div>`
        );
        marker.addTo(layer);
      });
    });

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
    }
  }, [days, activeDay, destination]);

  return <div ref={containerRef} className={className} />;
}
