-- Tabel pesan Merpati Mail.
-- Aturan utama: kolom body tidak bisa dibaca langsung oleh klien.
-- Body hanya keluar lewat fungsi open_message(), dan hanya jika now() >= arrive_at.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_email text not null,
  recipient_email text not null check (recipient_email = lower(recipient_email) and recipient_email like '%_@_%'),
  from_city text not null,
  to_city text not null check (to_city <> from_city),
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
create index messages_recipient_idx on public.messages (recipient_email, sent_at desc);

alter table public.messages enable row level security;

-- Pengirim dan penerima boleh melihat baris (tanpa body, lihat grant di bawah).
create policy "pengirim dan penerima bisa melihat"
  on public.messages for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_email = lower((select auth.jwt() ->> 'email'))
  );

-- Hanya pengirim yang boleh menghapus (membatalkan) kirimannya.
create policy "pengirim bisa menghapus"
  on public.messages for delete
  to authenticated
  using (sender_id = (select auth.uid()));

-- Tidak ada policy insert/update: pesan dibuat oleh server (service role),
-- supaya arrive_at dan events tidak bisa diatur dari browser.

revoke all on public.messages from anon, authenticated;
grant select (
  id, sender_id, sender_email, recipient_email, from_city, to_city, animal,
  pet_name, sent_at, arrive_at, distance_km, speedup, events
) on public.messages to authenticated;
grant delete on public.messages to authenticated;

-- Membuka isi pesan. Mengembalikan null jika belum mendarat atau bukan milik pemanggil.
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
    and (
      m.sender_id = auth.uid()
      or m.recipient_email = lower(auth.jwt() ->> 'email')
    );
$$;

revoke execute on function public.open_message(uuid) from public, anon;
grant execute on function public.open_message(uuid) to authenticated;
