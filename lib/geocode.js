// Geocoding dari browser: Nominatim (bawaan) atau MapTiler jika NEXT_PUBLIC_MAPTILER_KEY diisi.
// Kebijakan Nominatim: maksimal 1 permintaan per detik, jadi hanya dipanggil atas aksi pengguna.
import { GEOCODER } from "@/lib/map";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const MAPTILER = "https://api.maptiler.com/geocoding";

function uniqueJoin(parts) {
  const clean = parts.filter(Boolean);
  return clean.filter((p, i) => clean.indexOf(p) === i).join(", ").slice(0, 80);
}

// Nama daerah singkat, tanpa nama jalan atau nomor rumah.
function nominatimLabel(address = {}, fallback = "") {
  const area = address.suburb || address.village || address.neighbourhood || address.city_district || address.quarter;
  const city = address.city || address.town || address.municipality || address.county || address.regency || address.state;
  return uniqueJoin([area, city]) || fallback.split(",").slice(0, 2).join(",").trim().slice(0, 80);
}

function maptilerLabel(feature) {
  const ctx = feature.context ?? [];
  const find = (...types) => ctx.find((c) => types.some((t) => c.id?.startsWith(`${t}.`)))?.text;
  const isArea = ["neighbourhood", "place", "municipal_district", "locality"].some((t) => feature.place_type?.includes(t));
  const area = isArea ? feature.text : find("neighbourhood", "municipal_district", "locality", "place");
  const city = find("municipality", "county", "region") ?? (isArea ? null : feature.text);
  return uniqueJoin([area, city]) || String(feature.place_name ?? "").split(",").slice(0, 2).join(",").trim();
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  return res.json();
}

export async function reverseGeocode(lat, lng, lang = "en") {
  if (GEOCODER.provider === "maptiler") {
    const data = await getJson(`${MAPTILER}/${lng},${lat}.json?key=${GEOCODER.key}&language=${lang}&limit=1`);
    return data.features?.[0] ? maptilerLabel(data.features[0]) : "";
  }
  const data = await getJson(`${NOMINATIM}/reverse?format=jsonv2&zoom=14&accept-language=${lang}&lat=${lat}&lon=${lng}`);
  return nominatimLabel(data.address, data.display_name);
}

export async function searchPlaces(query, lang = "en") {
  const q = encodeURIComponent(query);
  if (GEOCODER.provider === "maptiler") {
    const data = await getJson(`${MAPTILER}/${q}.json?key=${GEOCODER.key}&language=${lang}&limit=5`);
    return (data.features ?? []).map((f) => ({
      lat: f.center[1],
      lng: f.center[0],
      label: maptilerLabel(f),
      detail: f.place_name,
    }));
  }
  const data = await getJson(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=${lang}&q=${q}`);
  return data.map((d) => ({
    lat: Number(d.lat),
    lng: Number(d.lon),
    label: nominatimLabel(d.address, d.display_name),
    detail: d.display_name,
  }));
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
