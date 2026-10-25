"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Peta rute satu perjalanan. Hanya dimuat di browser (next/dynamic, ssr: false).
export default function FlightMap({ from, to, position, emoji, label }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(elRef.current, {
      scrollWheelZoom: false,
      zoomAnimation: !reduce,
      fadeAnimation: !reduce,
      markerZoomAnimation: !reduce,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const a = [from.lat, from.lng];
    const b = [to.lat, to.lng];
    const group = L.layerGroup().addTo(map);

    L.polyline([a, b], { className: "route-line", dashArray: "6 8", weight: 2 }).addTo(group);
    for (const city of [from, to]) {
      L.circleMarker([city.lat, city.lng], { className: "city-dot", radius: 5, weight: 2 })
        .bindTooltip(city.name, { permanent: true, direction: "top", className: "city-label", offset: [0, -6] })
        .addTo(group);
    }

    markerRef.current = L.marker([position.lat, position.lng], {
      icon: L.divIcon({
        className: "courier-icon",
        html: `<span aria-hidden="true">${emoji}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      keyboard: false,
      title: label,
    }).addTo(group);

    map.fitBounds(L.latLngBounds([a, b]), { padding: [48, 48], maxZoom: 9 });

    return () => {
      group.remove();
      markerRef.current = null;
    };
    // posisi diperbarui di effect terpisah agar peta tidak di-fit ulang tiap detik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.id, to.id, emoji]);

  useEffect(() => {
    markerRef.current?.setLatLng([position.lat, position.lng]);
  }, [position.lat, position.lng]);

  return <div ref={elRef} className="map" role="img" aria-label={label} />;
}
