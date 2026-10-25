import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseEnv() {
  return Boolean(url && anonKey && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Klien atas nama pengguna yang sedang masuk (RLS berlaku).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // dipanggil dari Server Component; middleware yang memperbarui cookie
        }
      },
    },
  });
}

// Klien service role, melewati RLS. Hanya dipakai di server action untuk membuat pesan.
export function createAdminClient() {
  return createSupabaseClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Klien anon tanpa penyimpanan sesi, untuk memeriksa kata sandi tanpa menyentuh cookie pengguna.
export function createEphemeralClient() {
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
