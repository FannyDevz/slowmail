-- Kurir tambahan: angsa, burung hantu, lumba-lumba, kuda, unta, siput, dan pos.
alter table public.messages drop constraint messages_animal_check;
alter table public.messages add constraint messages_animal_check check (
  animal in (
    'elang', 'merpati', 'angsa', 'burung-hantu', 'lumba-lumba', 'kuda', 'pos',
    'unta', 'kucing', 'kura-kura', 'siput'
  )
);
