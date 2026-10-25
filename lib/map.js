// Penyedia tile peta. Bawaan: server OpenStreetMap (gratis, tapi kebijakannya melarang pemakaian berat).
// Untuk produksi dengan banyak pengguna, isi NEXT_PUBLIC_MAPTILER_KEY (paket gratis MapTiler tersedia).
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export const TILE_LAYER = MAPTILER_KEY
  ? {
      url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      attribution:
        '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
      maxZoom: 19,
    }
  : {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    };

export const GEOCODER = MAPTILER_KEY ? { provider: "maptiler", key: MAPTILER_KEY } : { provider: "nominatim" };
