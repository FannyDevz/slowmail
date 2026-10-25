-- Jumlah surat terkirim/diterima per pengguna untuk halaman super admin (/voyager).
-- Hanya service role (server) yang boleh memanggil; pengguna biasa tidak.
create function public.admin_message_counts(user_ids uuid[])
returns table (user_id uuid, sent bigint, received bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
    (select count(*) from public.messages m where m.sender_id = u.id),
    (select count(*) from public.messages m where m.recipient_id = u.id)
  from unnest(user_ids) as u (id);
$$;

revoke execute on function public.admin_message_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_message_counts(uuid[]) to service_role;
