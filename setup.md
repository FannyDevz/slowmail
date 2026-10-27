# Setup Slow Mail

Panduan menjalankan Slow Mail dari nol: di komputer sendiri, di Supabase, dan di Vercel.

## Yang dibutuhkan

- **Node.js 22 atau lebih baru** dan npm (`node -v` untuk cek).
- **Akun Supabase** (paket gratis cukup): https://supabase.com
- **Akun Vercel** untuk deploy (opsional saat development): https://vercel.com
- Supabase CLI tidak perlu dipasang; semua perintah di bawah memakai `npx supabase@2.122.0`.

## 1. Ambil kode dan pasang dependensi

```bash
git clone git@github.com:FannyDevz/slowmail.git
cd slowmail
npm install
```

## 2. Buat proyek Supabase

1. Di dashboard Supabase, buat proyek baru. Catat **password database** yang kamu buat; jangan simpan di repo.
2. Pilih region yang dekat dengan pengguna dan dengan region Vercel (lihat bagian 7). Proyek saat ini memakai **Tokyo (ap-northeast-1)**.
3. Catat **project ref**, yaitu bagian `xxxx` dari `https://xxxx.supabase.co`.

## 3. Hubungkan dan jalankan migrasi

Login sekali di **aplikasi Terminal biasa** (perintah ini membuka browser, jadi tidak bisa dijalankan di terminal non-interaktif):

```bash
npx supabase@2.122.0 login
```

Lalu hubungkan proyek dan buat semua tabel:

```bash
SUPABASE_DB_PASSWORD='password-database-kamu' npx supabase@2.122.0 link --project-ref <project-ref>
SUPABASE_DB_PASSWORD='password-database-kamu' npx supabase@2.122.0 db push --linked
```

Ini menjalankan semua file di `supabase/migrations/` secara berurutan:

| File | Isi |
|---|---|
| `0001_messages.sql` | tabel surat awal |
| `0002_profiles_addresses.sql` | profil, @username, alamat; surat dibuat ulang dengan penerima berdasarkan id |
| `0003_reply_drop_pet_name.sql` | balasan, hapus nama kurir |
| `0004_read_blocks_reports_events.sql` | penanda dibaca, blokir, laporan, event Realtime |
| `0005_admin_counts.sql` | hitungan surat untuk halaman admin |
| `0006_my_contacts.sql` | kontak untuk saran penerima |
| `0007_more_couriers.sql` | daftar kurir yang diizinkan |

Tidak perlu SQL Editor. Sebagai alternatif tanpa CLI, isi setiap file bisa ditempel berurutan di **SQL Editor** dashboard.

> Realtime untuk surat masuk aktif otomatis: migrasi `0004` menambahkan tabel `mail_events` ke publikasi `supabase_realtime`.

## 4. Isi environment variable

```bash
cp .env.example .env.local
```

Isi `.env.local` dari dashboard Supabase, **Project Settings → API Keys**:

| Variabel | Isi | Rahasia? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | tidak |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) atau anon key lama | tidak |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_…`) atau service_role key lama | **ya**, hanya untuk server |
| `ALLOW_SIMULATION` | `true` untuk menampilkan pilihan kecepatan simulasi di produksi | tidak |
| `NEXT_PUBLIC_MAPTILER_KEY` | opsional, lihat bagian 8 | tidak (dibatasi per origin) |

Secret key juga bisa diambil dari CLI tanpa membuka dashboard:

```bash
npx supabase@2.122.0 projects api-keys --project-ref <project-ref> --reveal
```

`.env.local` sudah ada di `.gitignore`. Jangan pernah memberi awalan `NEXT_PUBLIC_` pada secret key.

### Pengaturan Auth

Tidak ada yang wajib diubah. Akun dibuat lewat admin API dengan email langsung dianggap terverifikasi, jadi pengaturan "Confirm email" tidak berpengaruh dan tidak ada email yang dikirim saat mendaftar.

## 5. Jalankan

```bash
npm run dev      # http://localhost:3000
```

Coba alurnya:

1. Buka `/masuk`, pilih **Sign up**, daftar dengan email dan kata sandi (minimal 8 karakter).
2. Isi @username, nama, dan alamat di `/profil` (tombol **Detect my location**, cari alamat, atau klik peta).
3. Kirim surat ke @username sendiri dengan kecepatan simulasi **3,600x** (pilihan ini selalu muncul saat dev). Merpati Jakarta–Surabaya sampai dalam sekitar 11 detik.

Perintah lain:

```bash
npm test         # tes logika perjalanan, kamus, dan RLS (Postgres di memori, tanpa Supabase)
npm run build    # build produksi
npm start        # menjalankan hasil build
```

Jika dev server sedang jalan, build ke folder lain supaya tidak bentrok:

```bash
NEXT_DIST_DIR=.next-build npm run build
```

## 6. Super admin (`/voyager`)

Halaman `/voyager` menampilkan semua pengguna dan semua surat. Hanya akun dengan peran super admin yang bisa membukanya; yang lain mendapat 404.

```bash
npm run admin -- grant <email>          # jadikan super admin
npm run admin -- revoke <email>         # cabut
npm run admin -- list                   # daftar super admin
npm run admin -- set-password <email>   # ganti kata sandi (ketik tersembunyi)
```

- Akun harus sudah mendaftar lebih dulu.
- Setelah `grant`, **keluar lalu masuk lagi** supaya tautan Voyager muncul di header.
- `set-password` harus dijalankan di aplikasi Terminal biasa, bukan terminal non-interaktif.
- Kata sandi tidak bisa dilihat oleh siapa pun (Supabase hanya menyimpan hash); yang bisa dilakukan hanya menggantinya.

## 7. Deploy ke Vercel

1. Di Vercel, **Add New → Project**, impor repo `FannyDevz/slowmail`. Framework terdeteksi otomatis (Next.js); build command dan output bawaan tidak perlu diubah.
2. Di **Settings → Environment Variables**, isi variabel yang sama seperti `.env.local` (bagian 4).
3. Deploy. Setiap push ke `main` akan men-deploy ulang.

**Region:** `vercel.json` menaruh fungsi server di `hnd1` (Tokyo), dekat database Supabase. Setiap halaman memanggil database beberapa kali, jadi jarak ini sangat berpengaruh pada kecepatan. Jika proyek Supabase memakai region lain, ubah `regions` di `vercel.json` ke region Vercel terdekat (mis. `sin1` untuk Singapura).

**Simulasi:** di produksi, pilihan kecepatan simulasi tersembunyi kecuali `ALLOW_SIMULATION=true`.

## 8. MapTiler (opsional, disarankan untuk produksi)

Bawaannya peta memakai server tile OpenStreetMap dan pencarian alamat memakai Nominatim. Keduanya gratis, tetapi kebijakannya melarang pemakaian berat. Untuk produksi:

1. Daftar di https://cloud.maptiler.com dan buka **Account → API keys**.
2. Di pengaturan key, isi **Allowed HTTP origins** dengan `http://localhost:3000` dan domain Vercel kamu. Key ini terlihat di browser, jadi pembatasan origin inilah yang melindungi kuotamu.
3. Isi `NEXT_PUBLIC_MAPTILER_KEY` di `.env.local` dan di Vercel.
4. Restart `npm run dev` (variabel `NEXT_PUBLIC_` dibaca saat server mulai atau saat build), dan redeploy di Vercel.

Jika berhasil, pojok peta menampilkan "© MapTiler © OpenStreetMap".

## 9. CI

`.github/workflows/ci.yml` menjalankan `npm test` dan `npm run build` di setiap push ke `main` dan setiap pull request. Tidak butuh secret: tes memakai Postgres di memori (PGlite), dan build tanpa kunci Supabase tetap berhasil (halaman menampilkan petunjuk pengaturan).

## 10. Masalah yang sering muncul

| Gejala | Penyebab dan solusi |
|---|---|
| Halaman menampilkan "Supabase isn’t configured" | `.env.local` belum lengkap. Isi ketiga kunci Supabase lalu restart server. |
| `supabase login` gagal dengan "non-TTY" | Jalankan di aplikasi Terminal biasa, bukan terminal non-interaktif. |
| Build gagal di `next/font` | Gagal mengunduh font dari Google Fonts (jaringan). Ulangi build. |
| Port 3000 sudah dipakai | Hentikan proses lain di port itu, atau jalankan `npx next dev -p 3001`. |
| Tautan Voyager tidak muncul setelah `grant` | Keluar lalu masuk lagi supaya token sesi memuat peran baru. |
| Proyek Supabase berhenti merespons setelah lama tidak dipakai | Proyek paket gratis dijeda saat tidak aktif. Buka dashboard Supabase dan klik **Restore**. |
| `npm run dev` terasa lambat | Mode dev mengompilasi halaman saat pertama dibuka. Cek kecepatan sebenarnya dengan `npm run build && npm start`. |

Detail arsitektur dan aturan kode ada di [`CLAUDE.md`](./CLAUDE.md).
