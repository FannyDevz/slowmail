// Hewan kurir dan perhitungan perjalanan antar alamat.
// Posisi hewan tidak pernah disimpan: selalu dihitung dari progres waktu.

// Pilihan cepat di pemilih alamat jika deteksi lokasi tidak tersedia.
export const CITIES = [
  { id: "banda-aceh", name: "Banda Aceh", lat: 5.5483, lng: 95.3238 },
  { id: "medan", name: "Medan", lat: 3.5952, lng: 98.6722 },
  { id: "padang", name: "Padang", lat: -0.9471, lng: 100.4172 },
  { id: "palembang", name: "Palembang", lat: -2.9761, lng: 104.7754 },
  { id: "jakarta", name: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { id: "bandung", name: "Bandung", lat: -6.9175, lng: 107.6191 },
  { id: "semarang", name: "Semarang", lat: -6.9667, lng: 110.4167 },
  { id: "yogyakarta", name: "Yogyakarta", lat: -7.7956, lng: 110.3695 },
  { id: "surabaya", name: "Surabaya", lat: -7.2575, lng: 112.7521 },
  { id: "denpasar", name: "Denpasar", lat: -8.6705, lng: 115.2126 },
  { id: "mataram", name: "Mataram", lat: -8.5833, lng: 116.1167 },
  { id: "kupang", name: "Kupang", lat: -10.1772, lng: 123.607 },
  { id: "pontianak", name: "Pontianak", lat: -0.0263, lng: 109.3425 },
  { id: "balikpapan", name: "Balikpapan", lat: -1.2379, lng: 116.8529 },
  { id: "makassar", name: "Makassar", lat: -5.1477, lng: 119.4327 },
  { id: "manado", name: "Manado", lat: 1.4748, lng: 124.8421 },
  { id: "ambon", name: "Ambon", lat: -3.6954, lng: 128.1814 },
  { id: "jayapura", name: "Jayapura", lat: -2.5337, lng: 140.7181 },
];

// Nama, kata kerja, dan catatan kurir ada di kamus (lib/i18n.js, animals.*). Urutan di sini = urutan di form.
// "pos" bukan hewan, tapi diperlakukan sama: kecepatan rata-rata plus kejadian di jalan.
// Kejadian disimpan sebagai kunci (events.*) supaya bisa ditampilkan dalam dua bahasa.
export const ANIMALS = {
  elang: {
    id: "elang",
    emoji: "🦅",
    kmh: 90,
    events: [
      { key: "thermal", minH: 0.5, maxH: 1.5 },
      { key: "fish", minH: 0.5, maxH: 2 },
      { key: "peak", minH: 2, maxH: 5 },
    ],
  },
  merpati: {
    id: "merpati",
    emoji: "🕊️",
    kmh: 60,
    events: [
      { key: "rain", minH: 1, maxH: 3 },
      { key: "corn", minH: 0.5, maxH: 2 },
      { key: "lost", minH: 1, maxH: 4 },
      { key: "wire", minH: 0.5, maxH: 1.5 },
    ],
  },
  angsa: {
    id: "angsa",
    emoji: "🦢",
    kmh: 50,
    events: [
      { key: "lake", minH: 1, maxH: 3 },
      { key: "flock", minH: 2, maxH: 6 },
    ],
  },
  "burung-hantu": {
    id: "burung-hantu",
    emoji: "🦉",
    kmh: 40,
    events: [
      { key: "daylight", minH: 4, maxH: 10 },
      { key: "mouse", minH: 0.5, maxH: 1.5 },
    ],
  },
  "lumba-lumba": {
    id: "lumba-lumba",
    emoji: "🐬",
    kmh: 30,
    events: [
      { key: "wake", minH: 0.5, maxH: 2 },
      { key: "pod", minH: 1, maxH: 4 },
    ],
  },
  kuda: {
    id: "kuda",
    emoji: "🐎",
    kmh: 15,
    events: [
      { key: "river", minH: 0.5, maxH: 1.5 },
      { key: "horseshoe", minH: 2, maxH: 6 },
      { key: "stable", minH: 8, maxH: 12 },
    ],
  },
  pos: {
    id: "pos",
    emoji: "📮",
    kmh: 12,
    events: [
      { key: "sorting", minH: 6, maxH: 24 },
      { key: "weekend", minH: 24, maxH: 48 },
      { key: "truck", minH: 4, maxH: 12 },
      { key: "misrouted", minH: 12, maxH: 36 },
    ],
  },
  unta: {
    id: "unta",
    emoji: "🐫",
    kmh: 8,
    events: [
      { key: "oasis", minH: 2, maxH: 6 },
      { key: "stubborn", minH: 1, maxH: 5 },
    ],
  },
  kucing: {
    id: "kucing",
    emoji: "🐈",
    kmh: 4,
    events: [
      { key: "nap", minH: 3, maxH: 10 },
      { key: "dog", minH: 2, maxH: 6 },
      { key: "warung", minH: 1, maxH: 4 },
      { key: "ferry", minH: 6, maxH: 24 },
    ],
  },
  "kura-kura": {
    id: "kura-kura",
    emoji: "🐢",
    kmh: 2,
    events: [
      { key: "kangkung", minH: 12, maxH: 48 },
      { key: "shell", minH: 24, maxH: 72 },
      { key: "sunbathe", minH: 6, maxH: 24 },
    ],
  },
  siput: {
    id: "siput",
    emoji: "🐌",
    kmh: 0.5,
    events: [
      { key: "leaf", minH: 24, maxH: 72 },
      { key: "damp", minH: 48, maxH: 120 },
    ],
  },
};

export const SPEEDUPS = [1, 60, 3600, 86400];

// Pembulatan alamat ke 2 desimal (sekitar 1 km), dipakai juga di database.
export function roundCoord(n) {
  return Math.round(n * 100) / 100;
}

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// PRNG kecil dengan seed, supaya kejadian acak bisa ditentukan sekali saat kirim.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

// Kurir tetap berkeliling minimal 1 km walau pengirim dan penerima bertetangga.
export const MIN_DISTANCE_KM = 1;

// from/to: { lat, lng, label }
export function makeTrip({ from, to, animalId, speedup = 1, sentAt = Date.now() }) {
  const animal = ANIMALS[animalId];
  const distanceKm = Math.max(MIN_DISTANCE_KM, haversineKm(from, to));
  const travelH = distanceKm / animal.kmh;

  const rand = mulberry32(sentAt % 4294967296);
  const count = Math.floor(rand() * 3);
  const pool = [...animal.events];
  const events = [];
  for (let i = 0; i < count && pool.length; i++) {
    const [e] = pool.splice(Math.floor(rand() * pool.length), 1);
    events.push({
      key: e.key,
      at: round(0.15 + rand() * 0.7, 3), // titik di rute (fraksi jarak)
      hours: round(e.minH + rand() * (e.maxH - e.minH), 2),
    });
  }
  events.sort((a, b) => a.at - b.at);

  const totalH = travelH + events.reduce((s, e) => s + e.hours, 0);

  return {
    from,
    to,
    animalId,
    sentAt,
    speedup,
    distanceKm: round(distanceKm, 2),
    travelH,
    events,
    durMs: Math.round((totalH * 3600000) / speedup),
  };
}

// Baris tabel messages (Supabase) -> objek perjalanan yang dipakai UI.
export function tripFromRow(row) {
  const sentAt = Date.parse(row.sent_at);
  const distanceKm = Number(row.distance_km);
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    sender: row.sender,
    recipient: row.recipient,
    from: { lat: Number(row.from_lat), lng: Number(row.from_lng), label: row.from_label },
    to: { lat: Number(row.to_lat), lng: Number(row.to_lng), label: row.to_label },
    animalId: row.animal,
    replyTo: row.reply_to ?? null,
    readAt: row.read_at ? Date.parse(row.read_at) : null,
    sentAt,
    durMs: Date.parse(row.arrive_at) - sentAt,
    speedup: row.speedup,
    distanceKm,
    travelH: distanceKm / ANIMALS[row.animal].kmh,
    events: Array.isArray(row.events) ? row.events : [],
  };
}

export function getProgress(trip, now) {
  if (trip.durMs <= 0) return 1;
  return Math.min(1, Math.max(0, (now - trip.sentAt) / trip.durMs));
}

// Ubah progres waktu menjadi fraksi jarak, dengan memperhitungkan waktu mampir.
// pausedAt: indeks kejadian yang sedang berlangsung (-1 jika sedang jalan).
// passed: jumlah kejadian yang sudah selesai atau sedang berlangsung di belakang.
export function tripState(trip, progress) {
  if (progress >= 1) return { dist: 1, pausedAt: -1, passed: trip.events.length };
  const totalH = trip.travelH + trip.events.reduce((s, e) => s + e.hours, 0);
  let t = progress * totalH;
  let prevAt = 0;
  for (let i = 0; i < trip.events.length; i++) {
    const e = trip.events[i];
    const legH = (e.at - prevAt) * trip.travelH;
    if (t < legH) return { dist: prevAt + t / trip.travelH, pausedAt: -1, passed: i };
    t -= legH;
    if (t < e.hours) return { dist: e.at, pausedAt: i, passed: i };
    t -= e.hours;
    prevAt = e.at;
  }
  return { dist: Math.min(1, prevAt + t / trip.travelH), pausedAt: -1, passed: trip.events.length };
}

export function interpolate(from, to, f) {
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}

const UNITS = { d: ["day", "days"], h: ["hour", "hours"], m: ["minute", "minutes"], s: ["second", "seconds"] };

export function formatDuration(ms) {
  const u = UNITS;
  const part = (n, unit) => `${n} ${u[unit][n === 1 ? 0 : 1]}`;
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return h ? `${part(d, "d")} ${part(h, "h")}` : part(d, "d");
  if (h) return m ? `${part(h, "h")} ${part(m, "m")}` : part(h, "h");
  if (m) return sec && m < 10 ? `${part(m, "m")} ${part(sec, "s")}` : part(m, "m");
  return part(sec, "s");
}

export function formatSpeedup(n, intl = "en-GB") {
  return `${n.toLocaleString(intl)}x`;
}
