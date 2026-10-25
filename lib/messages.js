// Query daftar surat, dipakai halaman kotak surat dan server action "muat lebih banyak".
// body sengaja tidak ada di sini; isinya hanya lewat open_message().
export const MESSAGE_COLUMNS = `id, sender_id, recipient_id, from_label, from_lat, from_lng, to_label, to_lat, to_lng,
  animal, reply_to, read_at, sent_at, arrive_at, distance_km, speedup, events,
  sender:profiles!messages_sender_id_fkey(username, display_name),
  recipient:profiles!messages_recipient_id_fkey(username, display_name)`;

export const PAGE_SIZE = 30;

export async function fetchBlockedIds(supabase, userId) {
  const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", userId);
  return (data ?? []).map((b) => b.blocked_id);
}

// box: "inbox" | "sent". before: ISO sent_at untuk halaman berikutnya.
export async function fetchBox(supabase, userId, box, { before, blockedIds = [] } = {}) {
  let query = supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq(box === "inbox" ? "recipient_id" : "sender_id", userId)
    .order("sent_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("sent_at", before);
  if (box === "inbox" && blockedIds.length) query = query.not("sender_id", "in", `(${blockedIds.join(",")})`);

  const { data, error } = await query;
  if (error) return { rows: [], hasMore: false, error };
  return { rows: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE };
}
