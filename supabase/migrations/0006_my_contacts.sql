-- Kontak untuk saran penerima: orang yang pernah mengirim surat ke kita atau kita kirimi,
-- diurutkan dari yang terakhir berkirim surat. Pengguna yang kita blokir tidak ikut.
create function public.my_contacts(max_count int default 50)
returns table (username text, display_name text, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with others as (
    select case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other_id, m.sent_at
    from public.messages m
    where (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
      and m.sender_id <> m.recipient_id
  )
  select p.username, p.display_name, max(o.sent_at) as last_at
  from others o
  join public.profiles p on p.id = o.other_id
  where not exists (
    select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = o.other_id
  )
  group by p.username, p.display_name
  order by last_at desc
  limit least(greatest(max_count, 1), 200);
$$;

revoke execute on function public.my_contacts(int) from public, anon;
grant execute on function public.my_contacts(int) to authenticated;
