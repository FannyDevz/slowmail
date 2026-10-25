"use client";

import { createBrowserClient } from "@supabase/ssr";

let client;

// Klien Supabase di browser, hanya untuk Realtime (data tetap diambil lewat server).
export function getBrowserClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
