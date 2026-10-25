# CLAUDE.md

Panduan untuk Claude Code saat bekerja di proyek ini.

## Tentang proyek
Slow Mail adalah web surat yang diantar kurir: 10 hewan (elang, merpati, angsa, burung hantu, lumba-lumba, kuda, unta, kucing, kura-kura, siput) atau pos biasa. Setiap pengguna punya profil dengan **@username** dan **alamat** (titik di peta, bisa dideteksi dari lokasi). Surat dikirim ke @username; kurir berangkat dari alamat pengirim ke alamat penerima. Waktu tiba = jarak dibagi kecepatan hewan, posisinya bisa dilacak di peta, dan isi surat baru bisa dibuka setelah kurir "mendarat".

Nama produk: **Slow Mail** (konstanta `BRAND` di `lib/brand.js`, jangan ditulis langsung).

Antarmuka **bahasa Inggris saja** (diputuskan pemilik proyek supaya ringan). Semua teks yang dibaca pengguna ada di `lib/i18n.js`; jangan menulis teks langsung di komponen. Kalimat biasa (sentence case), kata kerja yang jelas ("Release courier", bukan "Submit").

## Perintah
- `npm install` — pasang dependensi
- `npm run dev` — jalankan di http://localhost:3000
- `npm test` — tes logika perjalanan, kamus, dan RLS (Postgres di memori lewat PGlite, tanpa Supabase). Jalan juga di CI (`.github/workflows/ci.yml`).
- `npm run build` — build produksi (dipakai Vercel). Jika dev server sedang jalan, pakai `NEXT_DIST_DIR=.next-build npm run build` supaya tidak menimpa `.next`.
- Di form, pilih kecepatan simulasi "3.600x" untuk menguji perjalanan dalam hitungan detik. Pilihan ini hanya muncul saat dev, atau di produksi jika `ALLOW_SIMULATION=true`.

## Menyiapkan Supabase
- Proyek: SlowMail (`<project-ref>`), sudah di-link lewat Supabase CLI (`npx supabase@2.122.0`).
- Migrasi baru: tambah file di `supabase/migrations/`, lalu `npx supabase@2.122.0 db push --linked` (butuh password database, berikan lewat `SUPABASE_DB_PASSWORD`, jangan disimpan di file).
- Kunci di `.env.local` (lihat `.env.example`): URL, publishable/anon key, dan secret key (`sb_secret_…`) untuk server. Isi yang sama di Environment Variables Vercel.
- Akun dibuat dengan email + kata sandi **tanpa verifikasi email**: `signUp` di `app/actions.js` memakai admin API dengan `email_confirm: true`. Karena email tidak diverifikasi, jangan pernah memakai email untuk otorisasi; selalu pakai `auth.uid()` / id profil.

## Stack
- Next.js 15 (App Router), React 19, JavaScript (bukan TypeScript)
- Leaflet untuk peta (tile OpenStreetMap), tanpa react-leaflet
- Supabase (Postgres + Auth email/kata sandi) lewat `@supabase/ssr` dan `@supabase/supabase-js`
- Geocoding: Nominatim (OpenStreetMap) dari browser, di `lib/geocode.js`. Maksimal 1 permintaan per detik, jadi hanya dipanggil atas aksi pengguna.
- CSS biasa di `app/globals.css`, tanpa Tailwind
- Font: DM Sans (500 isi, 700/800 judul) lewat `next/font/google`
- Teks: satu kamus di `lib/i18n.js` dengan `t("kunci", params)`. Di server lewat `getT()` (`lib/i18n-server.js`), di client lewat `useI18n()` (`components/I18nProvider.js`). Tidak ada pemilihan bahasa.
- Deploy: Vercel

## Struktur
```
app/layout.js               layout, font, metadata
app/(app)/                  route group halaman aplikasi yang sering dibuka, dengan loading.js (kerangka seketika saat pindah halaman)
app/icon.svg, app/apple-icon.js  favicon dan ikon iOS
app/(app)/page.js           kotak surat (butuh login + profil): ambil pesan tanpa body, render Mailroom. `?to=username` mengisi penerima
app/masuk/page.js           masuk / daftar
app/(app)/profil/page.js          isi atau ubah username, nama, dan alamat
app/(app)/pengaturan/page.js      notifikasi, ganti kata sandi/email, daftar blokir, hapus akun
app/not-found.js            404 bergaya
app/voyager/page.js         halaman super admin: semua pengguna dan semua surat (404 untuk selain super admin)
app/u/[username]/page.js    halaman publik pengguna (nama + nama daerah saja, tanpa koordinat)
app/actions.js              server action: daftar, masuk, keluar, simpan profil, cari penerima, kirim, buka, hapus
app/globals.css             semua style dan token warna
middleware.js               memperbarui cookie sesi Supabase
components/Mailroom.js      kotak surat: tab, belum dibaca, muat lebih banyak, balasan, pengalih HP
components/mail/            SendForm, RecipientInput (saran @username), TripRow, TripDetail (percakapan, blokir, laporkan),
                            Toasts, useMailNotifications (notifikasi + Realtime), shared
components/SettingsPanels.js  panel-panel halaman pengaturan
components/ProfileForm.js   form profil + pemilih alamat (deteksi lokasi, cari, klik peta, pilih kota)
components/LocationPicker.js  peta Leaflet untuk memilih titik alamat
components/FlightMap.js     peta Leaflet rute perjalanan
components/AuthForm.js, SiteHeader.js, SetupNotice.js, I18nProvider.js
lib/pigeon.js               hewan, rumus jarak, pembuatan perjalanan, format durasi, tripFromRow
lib/geocode.js              deteksi lokasi browser + Nominatim (reverse dan pencarian)
lib/i18n.js, lib/i18n-server.js  kamus teks dan aksesnya di server
lib/admin.js                cek peran super admin
scripts/admin.mjs           `npm run admin -- grant|revoke <email>` atau `npm run admin -- list`
lib/brand.js                nama produk
lib/messages.js             kolom dan query daftar surat (halaman per 30)
lib/map.js                  penyedia tile/geocoder (OSM bawaan, MapTiler jika NEXT_PUBLIC_MAPTILER_KEY diisi)
lib/supabase/browser.js     klien browser, hanya untuk Realtime
tests/                      node:test + PGlite
lib/session.js              getAuth() (identitas dari JWT, verifikasi lokal) dan getSession() (+ profil), keduanya di-cache per request
lib/supabase/server.js      klien Supabase untuk pengguna (RLS) dan admin (service role)
lib/config.js               flag kecepatan simulasi
supabase/migrations/        skema, RLS, dan fungsi open_message
```

## Cara kerja inti (jangan diubah tanpa alasan)
- **Tidak ada posisi yang disimpan terus-menerus.** Posisi hewan dihitung dari progres:
  `progress = (sekarang - sentAt) / durMs`, lalu diinterpolasi di garis lurus asal ke tujuan.
- `makeTrip()` di `lib/pigeon.js` menentukan kejadian acak **sekali saat pesan dikirim** (seed dari waktu kirim) dan menambah durasi total. Jangan mengacak ulang saat render.
- `durMs` sudah dibagi `speedup`, jadi simulasi cepat tidak perlu logika khusus di tempat lain.
- Isi pesan hanya keluar dari database lewat fungsi `open_message(id)`, yang mengecek `now() >= arrive_at` dan kepemilikan. Klien tidak punya hak `select` pada kolom `body`, jadi jangan pakai `select('*')`.
- Pesan dibuat **hanya di server** (`sendMessage` di `app/actions.js`, memakai service role). `makeTrip()` dijalankan dengan jam server, sehingga `arrive_at` dan `events` tidak bisa diatur dari browser. Tidak ada policy insert/update untuk pengguna.
- Alamat pengirim dan penerima **disalin ke pesan saat kirim**, jadi rute tidak berubah jika seseorang pindah alamat.
- Koordinat alamat dibulatkan 2 desimal (sekitar 1 km) sebelum disimpan. Halaman publik hanya menampilkan nama daerah.
- Jarak minimal 1 km (`MIN_DISTANCE_KM`), supaya surat ke tetangga atau diri sendiri tetap punya perjalanan.
- Teks dari pengguna (nama daerah, nama) tidak boleh masuk ke Leaflet sebagai string HTML; pakai elemen dengan `textContent`.
- Kejadian di perjalanan disimpan sebagai **kunci** (`events[].key`, mis. `rain`), teksnya diambil dari kamus `events.*`. Nama, kata kerja, dan catatan hewan juga di kamus (`animals.*`).
- **Super admin**: ditandai `app_metadata.role = "superadmin"` (pengguna tidak bisa mengubah `app_metadata`). `/voyager` memeriksa peran di server lalu membaca data dengan service role; selain super admin mendapat 404. Isi surat di `/voyager` tersembunyi sampai diklik. Super admin saat ini: (super admin email).
- Server action mengembalikan `{ error: "kunci", params }`, bukan kalimat; client menerjemahkan lewat `t("errors.<kunci>", params)`.
- **Balasan**: `messages.reply_to` menunjuk ke surat asli. `sendMessage` memvalidasi bahwa surat asli sudah sampai, penerimanya adalah pengirim balasan, dan balasan dikirim ke pengirim asli.
- Tidak ada nama kurir; hewan cukup disebut jenisnya.
- Menambah kurir: tambahkan di `ANIMALS` (`lib/pigeon.js`, urutannya = urutan di form), teksnya di kamus (`animals.<id>` dan `events.<key>`), lalu migrasi baru untuk memperluas `messages_animal_check`. Tes `tests/rls.test.mjs` memastikan semua kurir di kode diterima database.
- Saran penerima di form hanya dari kontak (`my_contacts()`: orang yang pernah berkirim surat dengan kita, tanpa yang diblokir). Tidak ada pencarian semua pengguna, supaya daftar pengguna tidak bisa ditelusuri; penerima baru diketik @username lengkap.
- Waktu: render pertama memakai `serverNow` dari server, dan tanggal baru diformat setelah mount (zona waktu pengguna, server Vercel memakai UTC). Ini mencegah hydration mismatch.

## Penyimpanan
- `public.profiles`: satu baris per pengguna (`username` unik, `display_name`, `address_label`, `lat`, `lng`). Semua pengguna yang masuk bisa membaca; hanya pemilik yang bisa membuat/mengubah.
- `public.messages`: `sender_id` dan `recipient_id` mengacu ke `profiles`, `reply_to` ke surat yang dibalas. `read_at` diisi `open_message()` saat penerima membuka surat.
- `public.blocks`: blokir berlaku dua arah saat mengirim (dicek di `sendMessage`), dan surat dari yang diblokir disaring dari kotak masuk. Tidak ada izin UPDATE, jadi pakai `insert`, bukan `upsert`.
- `public.reports`: pengguna hanya bisa membuat; ditinjau lewat dashboard Supabase.
- `public.mail_events`: baris kecil tanpa isi surat untuk Supabase Realtime (surat masuk baru). Jangan pernah menyiarkan tabel `messages` lewat Realtime. Pengirim dan penerima bisa melihat baris (tanpa `body`); hanya pengirim yang bisa menghapus.
- Surat baru masuk lewat Realtime (`mail_events`) + polling cadangan tiap 60 detik; posisi hewan tetap dihitung di browser.
- Notifikasi saat mendarat dijadwalkan di browser dari `arrive_at` (toast, atau notifikasi sistem jika tab tersembunyi dan izin diberikan). **Hanya selama aplikasi terbuka**; notifikasi saat aplikasi tertutup (email/Web Push) belum ada.

## Performa (penting: database di Tokyo, setiap query sekitar 150 ms dari Indonesia)
- Identitas di halaman, header, dan middleware memakai `auth.getClaims()` (JWT ES256 diverifikasi lokal, tanpa jaringan), bukan `getUser()`. `getUser()` hanya untuk server action yang mengubah data dan `/voyager`.
- `getAuth()`/`getSession()` dibungkus React `cache()`: header dan halaman berbagi hasil yang sama dalam satu request. Jangan memanggil Supabase auth lagi di komponen.
- Query yang tidak saling bergantung dijalankan dengan `Promise.all`.
- `loading.js` hanya di `app/(app)/`. Halaman yang bisa memanggil `notFound()` (`/voyager`, `/u/[username]`) sengaja di luar, karena streaming membuat status HTTP-nya 200, bukan 404.
- Klien Supabase di browser (Realtime, sekitar 70 kB) dimuat dengan `import()` setelah halaman tampil.
- `vercel.json` menaruh fungsi Vercel di `hnd1` (Tokyo), dekat database. Jika region Supabase berubah, ubah juga ini.
- Mode dev (`npm run dev`) selalu lebih lambat dari produksi karena mengompilasi halaman saat pertama dibuka.

## Gaya desain
- **Neo-brutalisme**, mengikuti token neobrutalism.dev (palet biru): garis hitam 2px, bayangan keras `4px 4px 0` tanpa blur, radius 5px, warna datar.
- Token di `:root`: `--bg`, `--surface`, `--fg`, `--mute`, `--main`, `--border`, `--red`, `--yellow`, `--green`, `--radius`, `--border-width`, `--shadow`. Pakai token, jangan hardcode hex baru.
- Tombol: saat hover bergeser sejauh bayangan dan bayangannya hilang (efek "ditekan"). Jangan tambah gradien, blur, atau bayangan lembut.
- Jejak tema pos udara tinggal satu: pita diagonal merah-putih-biru di atas kartu tulis surat (`.airmail`).
- Mobile: di bawah 920px hanya satu panel tampil (pengalih "Surat / Tulis" yang menempel di atas). Efek hover hanya untuk `@media (hover: hover)`; di layar sentuh peta rute tidak bisa digeser satu jari supaya halaman tetap bisa digulir.
- Hindari label huruf kapital dan animasi masuk di setiap bagian. Gerak hanya untuk hal yang berubah (bar progres, posisi hewan, efek tekan tombol).
- Harus tetap nyaman di layar HP, punya fokus keyboard yang terlihat, dan menghormati `prefers-reduced-motion`.

## Aturan kode
- Komponen yang memakai state, effect, atau Leaflet harus `"use client"`.
- Leaflet tidak boleh dirender di server. Selalu muat lewat `next/dynamic` dengan `ssr: false`.
- Jangan menambah dependensi berat tanpa alasan jelas. Pertahankan proyek ini kecil.
- Tanda kutip di teks yang dibaca pengguna memakai tipografi yang benar (’ “ ”), kecuali di dalam kode.

## Rencana berikutnya (urutan prioritas)
1. ~~Supabase: auth dan tabel `messages` dengan RLS~~ (selesai)
2. ~~Inbox penerima, `body` hanya setelah `arrive_at`~~ (selesai)
2b. ~~Profil, @username, alamat dengan deteksi lokasi, halaman publik `/u/[username]`~~ (selesai)
2c. ~~Balasan, dua bahasa, favicon, tampilan mobile~~ (selesai)
2d. ~~Belum dibaca, blokir/laporkan, saran penerima, pengaturan akun, 404, percakapan, peta yang bisa diganti, tes + CI, Realtime + paginasi~~ (selesai)
3. **Notifikasi saat aplikasi tertutup**: email lewat Resend atau Web Push, pemicu dari `pg_cron` (cari surat yang `arrive_at <= now()` dan belum dikabari).
3b. **Sebelum rilis publik**: captcha saat daftar, lupa kata sandi (butuh SMTP), reset password database.
4. **Fitur tambahan**: statistik per hewan (jumlah kiriman, total km), kirim dengan dua hewan sekaligus, mode "kirim ke masa depan", kartu rute yang bisa dibagikan.

## Hal yang perlu diputuskan pemilik proyek
- Sudah diputuskan: sistem pesan **internal**, alamat penerima berupa @username.
- Pendaftaran tanpa verifikasi email berarti siapa pun bisa membuat banyak akun. Pertimbangkan captcha (Supabase mendukung hCaptcha/Turnstile) atau batas pendaftaran per IP sebelum dibuka ke publik.
