-- Penanda dibaca, blokir, laporan, dan event realtime untuk surat masuk.

-- 1. Dibaca: diisi otomatis saat penerima membuka surat lewat open_message().
alter table public.messages add column read_at timestamptz;
grant select (read_at) on public.messages to authenticated;

create or replace function public.open_message(message_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result text;
begin
  select m.body into result
  from public.messages m
  where m.id = message_id
    and now() >= m.arrive_at
    and (m.sender_id = auth.uid() or m.recipient_id = auth.uid());

  if result is not null then
    update public.messages
    set read_at = now()
    where id = message_id and recipient_id = auth.uid() and read_at is null;
  end if;

  return result;
end;
$$;

-- 2. Blokir: surat dari pengguna yang diblokir tidak bisa dikirim dan tidak ditampilkan.
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "pengguna melihat blokirnya sendiri"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "pengguna memblokir atas nama sendiri"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "pengguna membuka blokirnya sendiri"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;

-- 3. Laporan: pengguna hanya bisa membuat; ditinjau lewat dashboard Supabase.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.reports enable row level security;

create policy "pengguna melapor atas nama sendiri"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant insert on public.reports to authenticated;

-- 4. Event realtime: baris kecil tanpa isi surat, supaya aman disiarkan lewat Supabase Realtime.
create table public.mail_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  kind text not null check (kind in ('incoming')),
  created_at timestamptz not null default now()
);

create index mail_events_user_idx on public.mail_events (user_id, created_at desc);

alter table public.mail_events enable row level security;

create policy "pengguna melihat event miliknya"
  on public.mail_events for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.mail_events from anon, authenticated;
grant select on public.mail_events to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mail_events;
  end if;
end;
$$;
