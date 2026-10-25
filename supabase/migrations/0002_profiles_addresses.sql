-- Konsep baru: setiap pengguna punya profil dengan alamat (titik di peta).
-- Surat dikirim ke @username, rutenya dari alamat pengirim ke alamat penerima.
-- Penerima dicocokkan lewat id, bukan email (akun dibuat tanpa verifikasi email).

drop function if exists public.open_message(uuid);
drop table if exists public.messages;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  address_label text not null check (char_length(address_label) between 1 and 80),
  -- Dibulatkan 2 desimal (sekitar 1 km) supaya rumah persisnya tidak terlihat orang lain.
  lat numeric(5, 2) not null check (lat between -90 and 90),
  lng numeric(5, 2) not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "pengguna masuk bisa melihat profil"
  on public.profiles for select
  to authenticated
  using (true);

create policy "pengguna membuat profil sendiri"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "pengguna mengubah profil sendiri"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- Alamat disalin saat kirim, supaya rute tidak berubah jika penerima pindah.
  from_label text not null,
  from_lat numeric(5, 2) not null,
  from_lng numeric(5, 2) not null,
  to_label text not null,
  to_lat numeric(5, 2) not null,
  to_lng numeric(5, 2) not null,
  animal text not null check (animal in ('merpati', 'elang', 'kucing', 'kura-kura')),
  pet_name text not null check (char_length(pet_name) between 1 and 30),
  body text not null check (char_length(body) between 1 and 5000),
  sent_at timestamptz not null default now(),
  arrive_at timestamptz not null check (arrive_at >= sent_at),
  distance_km numeric(8, 2) not null,
  speedup integer not null default 1 check (speedup >= 1),
  events jsonb not null default '[]'::jsonb
);

create index messages_sender_idx on public.messages (sender_id, sent_at desc);
create index messages_recipient_idx on public.messages (recipient_id, sent_at desc);

alter table public.messages enable row level security;

create policy "pengirim dan penerima bisa melihat"
  on public.messages for select
  to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "pengirim bisa menghapus"
  on public.messages for delete
  to authenticated
  using (sender_id = (select auth.uid()));

-- Tidak ada policy insert/update: pesan dibuat oleh server (service role).
revoke all on public.messages from anon, authenticated;
grant select (
  id, sender_id, recipient_id, from_label, from_lat, from_lng, to_label, to_lat, to_lng,
  animal, pet_name, sent_at, arrive_at, distance_km, speedup, events
) on public.messages to authenticated;
grant delete on public.messages to authenticated;

create function public.open_message(message_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.body
  from public.messages m
  where m.id = message_id
    and now() >= m.arrive_at
    and (m.sender_id = auth.uid() or m.recipient_id = auth.uid());
$$;

revoke execute on function public.open_message(uuid) from public, anon;
grant execute on function public.open_message(uuid) to authenticated;
