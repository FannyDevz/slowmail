"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_LAYER } from "@/lib/map";

// Peta rute satu perjalanan. Hanya dimuat di browser (next/dynamic, ssr: false).
export default function FlightMap({ from, to, position, emoji, label }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(elRef.current, {
      scrollWheelZoom: false,
      // Di layar sentuh, geser satu jari dipakai untuk menggulir halaman, bukan peta.
      dragging: !L.Browser.mobile,
      zoomAnimation: !reduce,
      fadeAnimation: !reduce,
      markerZoomAnimation: !reduce,
    });
    L.tileLayer(TILE_LAYER.url, {
      maxZoom: TILE_LAYER.maxZoom,
      attribution: TILE_LAYER.attribution,
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

    L.polyline([a, b], { className: "route-line", dashArray: "8 8", weight: 3 }).addTo(group);
    for (const city of [from, to]) {
      // Nama daerah diisi pengguna; pakai textContent supaya tidak diproses sebagai HTML.
      const tip = document.createElement("span");
      tip.textContent = city.label;
      L.circleMarker([city.lat, city.lng], { className: "city-dot", radius: 6, weight: 3 })
        .bindTooltip(tip, { permanent: true, direction: "top", className: "city-label", offset: [0, -6] })
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
  }, [from.lat, from.lng, to.lat, to.lng, emoji]);

  useEffect(() => {
    markerRef.current?.setLatLng([position.lat, position.lng]);
  }, [position.lat, position.lng]);

  return <div ref={elRef} className="map" role="img" aria-label={label} />;
}
