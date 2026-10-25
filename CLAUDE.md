# CLAUDE.md

Panduan untuk Claude Code saat bekerja di proyek ini.

## Tentang proyek
Merpati Mail adalah web email yang dikirim oleh hewan (merpati, elang, kucing, kura-kura). Pesan baru bisa dibuka penerima setelah hewan kurirnya "mendarat". Waktu tiba dihitung dari jarak kota dibagi kecepatan hewan, dan posisinya bisa dilacak di peta.

Bahasa antarmuka dan salinan teks: **Bahasa Indonesia**, kalimat biasa (sentence case), kata kerja yang jelas ("Lepas kurir", bukan "Submit").

## Perintah
- `npm install` — pasang dependensi
- `npm run dev` — jalankan di http://localhost:3000
- `npm run build` — build produksi (dipakai Vercel)
- Di form, pilih kecepatan simulasi "3.600x" untuk menguji perjalanan dalam hitungan detik.

## Stack
- Next.js 15 (App Router), React 19, JavaScript (bukan TypeScript)
- Leaflet untuk peta (tile OpenStreetMap), tanpa react-leaflet
- CSS biasa di `app/globals.css`, tanpa Tailwind
- Font: Young Serif (judul) dan Figtree (isi) lewat `next/font/google`
- Deploy: Vercel

## Struktur
```
app/layout.js         layout, font, metadata
app/page.js           halaman utama: form kirim, daftar perjalanan, detail tracking (client component)
app/globals.css       semua style dan token warna
components/FlightMap.js   peta Leaflet (dimuat dengan dynamic import, ssr: false)
lib/pigeon.js         kota, hewan, rumus jarak, pembuatan perjalanan, format durasi
```

## Cara kerja inti (jangan diubah tanpa alasan)
- **Tidak ada posisi yang disimpan terus-menerus.** Posisi hewan dihitung dari progres:
  `progress = (sekarang - sentAt) / durMs`, lalu diinterpolasi di garis lurus asal ke tujuan.
- `makeTrip()` di `lib/pigeon.js` menentukan kejadian acak **sekali saat pesan dikirim** (seed dari waktu kirim) dan menambah durasi total. Jangan mengacak ulang saat render.
- `durMs` sudah dibagi `speedup`, jadi simulasi cepat tidak perlu logika khusus di tempat lain.
- Isi pesan hanya ditampilkan jika `progress >= 1`. Saat backend ditambahkan, pengecekan ini harus dilakukan **di server**, bukan hanya di UI.

## Penyimpanan saat ini
Pesan disimpan di `localStorage` dengan key `merpati-mail:v1`. Ini hanya untuk MVP, jadi pesan hanya terlihat di browser yang sama. Bungkus akses `localStorage` dengan try/catch.

## Gaya desain
- Tema surat pos udara: garis diagonal merah-putih-biru di sekeliling form (`.envelope`) adalah satu elemen yang menonjol. Elemen lain dibuat tenang.
- Token warna ada di `:root`: `--paper`, `--ink`, `--blue`, `--red`, `--mute`, `--line`. Pakai token, jangan hardcode hex baru.
- Hindari kartu seragam berlebihan, label huruf kapital, dan animasi masuk di setiap bagian. Gerak hanya untuk hal yang berubah (bar progres, posisi hewan).
- Harus tetap nyaman di layar HP, punya fokus keyboard yang terlihat, dan menghormati `prefers-reduced-motion`.

## Aturan kode
- Komponen yang memakai state, effect, atau Leaflet harus `"use client"`.
- Leaflet tidak boleh dirender di server. Selalu muat lewat `next/dynamic` dengan `ssr: false`.
- Jangan menambah dependensi berat tanpa alasan jelas. Pertahankan proyek ini kecil.
- Tanda kutip di teks yang dibaca pengguna memakai tipografi yang benar (’ “ ”), kecuali di dalam kode.

## Rencana berikutnya (urutan prioritas)
1. **Supabase**: auth dan tabel `messages` (`sender_id`, `recipient_email`, `from_city`, `to_city`, `animal`, `pet_name`, `body`, `sent_at`, `arrive_at`, `events` jsonb). Gunakan Row Level Security.
2. **Inbox penerima**: penerima melihat pesan miliknya. Endpoint server hanya mengembalikan `body` jika `now() >= arrive_at`.
3. **Notifikasi saat mendarat**: Resend untuk email, pemicu dari `pg_cron` atau Supabase Edge Function.
4. **Fitur tambahan**: statistik per hewan (jumlah kiriman, total km), kirim dengan dua hewan sekaligus, mode "kirim ke masa depan", kartu rute yang bisa dibagikan.

## Hal yang perlu diputuskan pemilik proyek
- Sistem pesan internal (sesama pengguna) atau benar-benar email ke Gmail/Outlook. Saat ini diasumsikan **internal**, karena menunda SMTP jauh lebih rumit (spam, keandalan).
