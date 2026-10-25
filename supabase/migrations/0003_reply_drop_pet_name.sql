-- Nama kurir dihapus; hewan cukup disebut jenisnya.
alter table public.messages drop column pet_name;

-- Balasan: menunjuk ke surat yang dibalas. Validasinya (hanya penerima yang
-- sudah menerima surat itu yang boleh membalas, ke pengirimnya) ada di server action.
alter table public.messages
  add column reply_to uuid references public.messages (id) on delete set null;

create index messages_reply_to_idx on public.messages (reply_to);

grant select (reply_to) on public.messages to authenticated;
