import { createClient } from "@/lib/supabase/server";

// Pengguna yang sedang masuk beserta profilnya (null jika belum dibuat).
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, address_label, lat, lng")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile };
}
