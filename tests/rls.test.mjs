import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { as, asService, createDb } from "./helpers/db.mjs";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const LANDED = "aaaaaaaa-0000-0000-0000-000000000001";
const FLYING = "aaaaaaaa-0000-0000-0000-000000000002";

let db;
const rows = (sql) => async () => (await db.query(sql)).rows;

before(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users values ('${A}', 'a@x.id'), ('${B}', 'b@x.id'), ('${C}', 'c@x.id');`);
  for (const [id, name, lat] of [[A, "ani", -6.23], [B, "budi", -7.27], [C, "citra", -8.65]]) {
    await as(db, id, rows(`insert into public.profiles (id, username, display_name, address_label, lat, lng)
      values ('${id}', '${name}', '${name}', 'Daerah ${name}', ${lat}, 110.5)`));
  }
  await asService(db, `insert into public.messages
    (id, sender_id, recipient_id, from_label, from_lat, from_lng, to_label, to_lat, to_lng, animal, body, sent_at, arrive_at, distance_km)
    values
    ('${LANDED}', '${A}', '${B}', 'a', 0, 0, 'b', 0, 0, 'merpati', 'sudah tiba', now() - interval '2 hour', now() - interval '1 hour', 600),
    ('${FLYING}', '${A}', '${B}', 'a', 0, 0, 'b', 0, 0, 'merpati', 'masih terbang', now(), now() + interval '1 hour', 600)`);
});

after(() => db.close());

describe("profil", () => {
  test("pengguna tidak bisa membuat profil atas nama orang lain", async () => {
    const res = await as(db, C, rows(`insert into public.profiles (id, username, display_name, address_label, lat, lng)
      values ('${A}', 'palsu', 'x', 'x', 0, 0)`));
    assert.match(res, /row-level security/);
  });

  test("username harus unik dan sesuai pola", async () => {
    assert.match(await as(db, C, rows(`update public.profiles set username = 'ani' where id = '${C}'`)), /duplicate key/);
    assert.match(await as(db, C, rows(`update public.profiles set username = 'A B' where id = '${C}'`)), /check constraint/);
  });

  test("tidak bisa mengubah profil orang lain", async () => {
    assert.deepEqual(await as(db, C, rows(`update public.profiles set display_name = 'x' where id = '${A}' returning id`)), []);
  });

  test("koordinat dibulatkan 2 desimal", async () => {
    const [row] = await as(db, A, rows(`update public.profiles set lat = -6.23456 where id = '${A}' returning lat`));
    assert.equal(row.lat, "-6.23");
  });

  test("anon tidak bisa membaca profil", async () => {
    assert.match(await as(db, null, rows("select * from public.profiles")), /permission denied/);
  });
});

describe("surat", () => {
  test("hanya pengirim dan penerima yang melihat baris", async () => {
    const count = (uid) => as(db, uid, async () => (await db.query("select count(*)::int n from public.messages")).rows[0].n);
    assert.equal(await count(A), 2);
    assert.equal(await count(B), 2);
    assert.equal(await count(C), 0);
  });

  test("kolom body tidak bisa dibaca langsung", async () => {
    assert.match(await as(db, B, rows("select body from public.messages")), /permission denied/);
    assert.match(await as(db, B, rows("select * from public.messages")), /permission denied/);
  });

  test("open_message hanya membuka surat yang sudah mendarat, untuk pemiliknya", async () => {
    const open = (uid, id) => as(db, uid, async () => (await db.query(`select public.open_message('${id}') b`)).rows[0].b);
    assert.equal(await open(B, FLYING), null);
    assert.equal(await open(C, LANDED), null);
    assert.equal(await open(B, LANDED), "sudah tiba");
  });

  test("membuka surat menandai dibaca, hanya oleh penerima", async () => {
    const [row] = await as(db, B, rows(`select read_at from public.messages where id = '${LANDED}'`));
    assert.ok(row.read_at, "read_at terisi setelah dibuka penerima");
    const [flying] = await as(db, B, rows(`select read_at from public.messages where id = '${FLYING}'`));
    assert.equal(flying.read_at, null);
  });

  test("pengguna tidak bisa membuat atau mengubah surat", async () => {
    assert.match(await as(db, B, rows(`insert into public.messages
      (sender_id, recipient_id, from_label, from_lat, from_lng, to_label, to_lat, to_lng, animal, body, arrive_at, distance_km)
      values ('${B}', '${A}', 'x', 0, 0, 'y', 0, 0, 'elang', 'x', now(), 1)`)), /permission denied/);
    assert.match(await as(db, B, rows(`update public.messages set arrive_at = now()`)), /permission denied/);
  });

  test("hanya pengirim yang bisa menghapus", async () => {
    await as(db, B, rows(`delete from public.messages where id = '${FLYING}'`));
    assert.equal((await asService(db, `select count(*)::int n from public.messages where id = '${FLYING}'`))[0].n, 1);
    await as(db, A, rows(`delete from public.messages where id = '${FLYING}'`));
    assert.equal((await asService(db, `select count(*)::int n from public.messages where id = '${FLYING}'`))[0].n, 0);
  });

  test("anon tidak bisa memanggil open_message", async () => {
    assert.match(await as(db, null, rows(`select public.open_message('${LANDED}')`)), /permission denied/);
  });
});

describe("blokir dan laporan", () => {
  test("pengguna hanya bisa memblokir atas nama sendiri dan melihat blokirnya sendiri", async () => {
    await as(db, B, rows(`insert into public.blocks (blocker_id, blocked_id) values ('${B}', '${A}')`));
    assert.match(await as(db, C, rows(`insert into public.blocks (blocker_id, blocked_id) values ('${A}', '${C}')`)), /row-level security/);
    assert.equal((await as(db, B, rows("select * from public.blocks"))).length, 1);
    assert.equal((await as(db, A, rows("select * from public.blocks"))).length, 0);
  });

  test("tidak bisa memblokir diri sendiri", async () => {
    assert.match(await as(db, C, rows(`insert into public.blocks (blocker_id, blocked_id) values ('${C}', '${C}')`)), /check constraint/);
  });

  test("laporan hanya bisa dibuat, tidak bisa dibaca pengguna", async () => {
    const res = await as(db, B, rows(`insert into public.reports (reporter_id, reported_id, reason) values ('${B}', '${A}', 'spam')`));
    assert.deepEqual(res, []);
    assert.match(await as(db, B, rows("select * from public.reports")), /permission denied/);
    assert.match(await as(db, B, rows(`insert into public.reports (reporter_id, reported_id, reason) values ('${A}', '${C}', 'x')`)), /row-level security/);
  });

  test("event realtime hanya terlihat oleh pemiliknya", async () => {
    await asService(db, `insert into public.mail_events (user_id, message_id, kind) values ('${B}', '${LANDED}', 'incoming')`);
    assert.equal((await as(db, B, rows("select * from public.mail_events"))).length, 1);
    assert.equal((await as(db, C, rows("select * from public.mail_events"))).length, 0);
  });
});

describe("izin tabel blocks", () => {
  test("upsert (ON CONFLICT DO UPDATE) ditolak, jadi server action harus memakai insert", async () => {
    const res = await as(db, C, rows(`insert into public.blocks (blocker_id, blocked_id) values ('${C}', '${A}')
      on conflict (blocker_id, blocked_id) do update set created_at = now()`));
    assert.match(res, /permission denied/);
  });
});

describe("fungsi admin", () => {
  test("admin_message_counts hanya untuk service role", async () => {
    assert.match(await as(db, A, rows(`select * from public.admin_message_counts(array['${A}']::uuid[])`)), /permission denied/);
    assert.match(await as(db, null, rows(`select * from public.admin_message_counts(array['${A}']::uuid[])`)), /permission denied/);
    const [row] = await asService(db, `select sent::int, received::int from public.admin_message_counts(array['${A}']::uuid[])`);
    assert.ok(row.sent >= 1);
  });
});

describe("kontak", () => {
  test("my_contacts hanya berisi orang yang pernah berkirim surat dengan kita", async () => {
    const contacts = async (uid) => (await as(db, uid, rows("select username from public.my_contacts()"))).map((r) => r.username);
    // A pernah mengirim ke B; C tidak pernah berkirim surat dengan siapa pun.
    assert.deepEqual(await contacts(A), ["budi"]);
    assert.deepEqual(await contacts(C), []);
  });

  test("pengguna yang diblokir tidak muncul sebagai kontak", async () => {
    // Di tes sebelumnya B memblokir A.
    const res = (await as(db, B, rows("select username from public.my_contacts()"))).map((r) => r.username);
    assert.ok(!res.includes("ani"));
  });

  test("anon tidak bisa memanggil my_contacts", async () => {
    assert.match(await as(db, null, rows("select * from public.my_contacts()")), /permission denied/);
  });
});

describe("jenis kurir", () => {
  const insert = (animal) =>
    asService(db, `insert into public.messages
      (sender_id, recipient_id, from_label, from_lat, from_lng, to_label, to_lat, to_lng, animal, body, arrive_at, distance_km)
      values ('${A}', '${B}', 'a', 0, 0, 'b', 0, 0, '${animal}', 'x', now(), 1) returning animal`).catch((e) => `ERROR: ${e.message}`);

  test("semua kurir di lib/pigeon.js diterima database", async () => {
    const { ANIMALS } = await import("../lib/pigeon.js");
    for (const id of Object.keys(ANIMALS)) assert.deepEqual(await insert(id), [{ animal: id }], id);
  });

  test("kurir yang tidak dikenal ditolak", async () => {
    assert.match(await insert("naga"), /check constraint/);
  });
});
