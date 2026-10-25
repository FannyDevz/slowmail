import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Pengguna yang sedang masuk, dari JWT di cookie.
// getClaims() memverifikasi JWT secara lokal (kunci ES256 dari JWKS, di-cache), jadi tanpa panggilan jaringan.
// Untuk aksi yang mengubah data, server action tetap memakai getUser() yang bertanya ke server Auth.
// cache() membuat halaman, header, dan komponen lain dalam satu request memakai hasil yang sama.
export const getAuth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user = claims?.sub ? { id: claims.sub, email: claims.email, app_metadata: claims.app_metadata ?? {} } : null;
  return { supabase, user };
});

// Pengguna beserta profilnya (null jika belum dibuat).
export const getSession = cache(async () => {
  const { supabase, user } = await getAuth();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, address_label, lat, lng")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile };
});
