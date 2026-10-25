"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_LAYER } from "@/lib/map";
import { useI18n } from "@/components/I18nProvider";

const INDONESIA = [-2.5, 118];

// Peta untuk memilih titik alamat: klik peta atau geser penanda. Hanya dimuat di browser.
export default function LocationPicker({ value, onPick }) {
  const { t } = useI18n();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(elRef.current, { scrollWheelZoom: false, zoomAnimation: !reduce, fadeAnimation: !reduce });
    L.tileLayer(TILE_LAYER.url, {
      maxZoom: TILE_LAYER.maxZoom,
      attribution: TILE_LAYER.attribution,
    }).addTo(map);
    map.setView(INDONESIA, 4);
    map.on("click", (e) => onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    const latlng = [value.lat, value.lng];
    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: "pin-icon", html: '<span aria-hidden="true">📍</span>', iconSize: [36, 36], iconAnchor: [18, 34] }),
        title: t("profile.pinTitle"),
      }).addTo(map);
      markerRef.current.on("dragend", (e) => {
        const p = e.target.getLatLng();
        onPickRef.current({ lat: p.lat, lng: p.lng });
      });
    } else {
      markerRef.current.setLatLng(latlng);
    }
    map.setView(latlng, Math.max(map.getZoom(), 12));
  }, [value?.lat, value?.lng]);

  return <div ref={elRef} className="map map--picker" role="application" aria-label={t("profile.mapLabel")} />;
}
