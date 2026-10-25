// Data kota, hewan kurir, dan perhitungan perjalanan.
// Posisi hewan tidak pernah disimpan: selalu dihitung dari progres waktu.

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

export const ANIMALS = {
  merpati: {
    id: "merpati",
    name: "Merpati",
    emoji: "🕊️",
    kmh: 60,
    verb: "terbang",
    defaultName: "Abu",
    note: "Setia dan cukup cepat, tapi suka mampir.",
    events: [
      { text: "Berteduh dari hujan di atap masjid", minH: 1, maxH: 3 },
      { text: "Mampir makan jagung di alun-alun", minH: 0.5, maxH: 2 },
      { text: "Sempat salah arah, lalu kembali ke jalur", minH: 1, maxH: 4 },
      { text: "Istirahat di kabel listrik", minH: 0.5, maxH: 1.5 },
    ],
  },
  elang: {
    id: "elang",
    name: "Elang",
    emoji: "🦅",
    kmh: 90,
    verb: "terbang",
    defaultName: "Rajawali",
    note: "Paling cepat. Kadang berhenti berburu.",
    events: [
      { text: "Berputar menunggu angin naik", minH: 0.5, maxH: 1.5 },
      { text: "Menyambar ikan dulu", minH: 0.5, maxH: 2 },
      { text: "Bertengger di puncak gunung", minH: 2, maxH: 5 },
    ],
  },
  kucing: {
    id: "kucing",
    name: "Kucing",
    emoji: "🐈",
    kmh: 4,
    verb: "berjalan",
    defaultName: "Oyen",
    note: "Jalan santai, tidur di mana saja.",
    events: [
      { text: "Tidur siang di bawah mobil", minH: 3, maxH: 10 },
      { text: "Dikejar anjing kampung, ambil jalan memutar", minH: 2, maxH: 6 },
      { text: "Diberi makan ibu warung", minH: 1, maxH: 4 },
      { text: "Menunggu kapal penyeberangan", minH: 6, maxH: 24 },
    ],
  },
  "kura-kura": {
    id: "kura-kura",
    name: "Kura-kura",
    emoji: "🐢",
    kmh: 2,
    verb: "merangkak",
    defaultName: "Lambat",
    note: "Pelan sekali. Pesannya pasti sampai.",
    events: [
      { text: "Berhenti makan kangkung", minH: 12, maxH: 48 },
      { text: "Masuk cangkang karena hujan deras", minH: 24, maxH: 72 },
      { text: "Berjemur di batu", minH: 6, maxH: 24 },
    ],
  },
};

export const SPEEDUPS = [1, 60, 3600, 86400];

export function cityById(id) {
  return CITIES.find((c) => c.id === id);
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

export function makeTrip({ fromId, toId, animalId, petName, recipient, body, speedup = 1, sentAt = Date.now() }) {
  const from = cityById(fromId);
  const to = cityById(toId);
  const animal = ANIMALS[animalId];
  const distanceKm = haversineKm(from, to);
  const travelH = distanceKm / animal.kmh;

  const rand = mulberry32(sentAt % 4294967296);
  const count = Math.floor(rand() * 3);
  const pool = [...animal.events];
  const events = [];
  for (let i = 0; i < count && pool.length; i++) {
    const [e] = pool.splice(Math.floor(rand() * pool.length), 1);
    events.push({
      text: e.text,
      at: round(0.15 + rand() * 0.7, 3), // titik di rute (fraksi jarak)
      hours: round(e.minH + rand() * (e.maxH - e.minH), 2),
    });
  }
  events.sort((a, b) => a.at - b.at);

  const totalH = travelH + events.reduce((s, e) => s + e.hours, 0);

  return {
    id: `${sentAt.toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`,
    fromId,
    toId,
    animalId,
    petName: petName?.trim() || animal.defaultName,
    recipient: recipient.trim(),
    body,
    sentAt,
    speedup,
    distanceKm: Math.round(distanceKm),
    travelH,
    events,
    durMs: Math.round((totalH * 3600000) / speedup),
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

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return h ? `${d} hari ${h} jam` : `${d} hari`;
  if (h) return m ? `${h} jam ${m} menit` : `${h} jam`;
  if (m) return sec && m < 10 ? `${m} menit ${sec} detik` : `${m} menit`;
  return `${sec} detik`;
}

export function formatSpeedup(n) {
  return `${n.toLocaleString("id-ID")}x`;
}
