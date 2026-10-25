// Postgres di memori (PGlite) dengan tiruan minimal skema auth Supabase, lalu semua migrasi dijalankan.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "supabase", "migrations");

export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated;
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec("grant all on all tables in schema public to service_role;");
  return db;
}

// Menjalankan fn sebagai pengguna tertentu (atau anon jika uid null). Error dikembalikan sebagai string.
export async function as(db, uid, fn) {
  if (uid) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  } else {
    await db.exec("set role anon;");
  }
  try {
    return await fn();
  } catch (e) {
    return `ERROR: ${e.message}`;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

export async function asService(db, sql) {
  await db.exec("set role service_role;");
  try {
    return (await db.query(sql)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
