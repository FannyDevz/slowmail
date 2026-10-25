"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient, createEphemeralClient } from "@/lib/supabase/server";
import { ANIMALS, SPEEDUPS, makeTrip, roundCoord } from "@/lib/pigeon";
import { isSimulationAllowed } from "@/lib/config";
import { fetchBlockedIds, fetchBox } from "@/lib/messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD = 8;
const MAX_PER_MINUTE = 5;
const PROFILE_COLUMNS = "id, username, display_name, address_label, lat, lng";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function readCredentials(formData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

// Akun dibuat lewat admin API dengan email_confirm: true, jadi tidak perlu verifikasi email.
export async function signUp(_prev, formData) {
  const { email, password } = readCredentials(formData);
  if (!EMAIL_RE.test(email)) return { error: "invalidEmail", email };
  if (password.length < MIN_PASSWORD) return { error: "passwordShort", params: { min: MIN_PASSWORD }, email };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const exists = error.code === "email_exists" || /already/i.test(error.message);
    return { error: exists ? "emailExists" : "signUpFailed", email };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "signInAfterSignUp", email };
  redirect("/profil");
}

export async function signIn(_prev, formData) {
  const { email, password } = readCredentials(formData);
  if (!EMAIL_RE.test(email) || !password) return { error: "missingCredentials", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "wrongCredentials", email };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

export async function saveProfile(input) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };

  const username = String(input?.username ?? "").trim().toLowerCase().replace(/^@/, "");
  const displayName = String(input?.displayName ?? "").trim();
  const label = String(input?.label ?? "").trim();
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);

  if (!USERNAME_RE.test(username)) return { error: "usernameInvalid" };
  if (!displayName || displayName.length > 40) return { error: "displayNameInvalid" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "pointMissing" };
  }
  if (!label || label.length > 80) return { error: "labelInvalid" };

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name: displayName,
    address_label: label,
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    updated_at: new Date().toISOString(),
  });

  if (error?.code === "23505") return { error: "usernameTaken", params: { username } };
  if (error) return { error: "profileSaveFailed" };
  revalidatePath("/", "layout");
  return { ok: true, username };
}

// Dipakai form kirim untuk menampilkan tujuan dan perkiraan waktu sebelum kurir dilepas.
export async function findRecipient(rawUsername) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const username = String(rawUsername ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return { notFound: true };

  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("username", username).maybeSingle();
  if (!data) return { notFound: true };
  return {
    recipient: {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      label: data.address_label,
      lat: Number(data.lat),
      lng: Number(data.lng),
    },
  };
}

export async function sendMessage(input) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };

  const username = String(input?.to ?? "").trim().toLowerCase().replace(/^@/, "");
  const body = String(input?.body ?? "").trim();
  const replyTo = typeof input?.replyTo === "string" ? input.replyTo : null;
  const animalId = input?.animalId;
  const speedup = isSimulationAllowed() && SPEEDUPS.includes(input?.speedup) ? input.speedup : 1;

  if (!ANIMALS[animalId]) return { error: "unknownAnimal" };
  if (!body || body.length > 5000) return { error: "bodyLength" };

  const [{ data: me }, { data: them }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("username", username).maybeSingle(),
  ]);
  if (!me) return { error: "needProfile" };
  if (!them) return { error: "recipientNotFound", params: { username } };

  const admin = createAdminClient();

  // Blokir berlaku dua arah: tidak bisa mengirim ke orang yang memblokir kita, atau yang kita blokir.
  const { data: blocks } = await admin
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${them.id},blocked_id.eq.${me.id}),and(blocker_id.eq.${me.id},blocked_id.eq.${them.id})`);
  if (blocks?.some((b) => b.blocker_id === me.id)) return { error: "youBlocked", params: { username } };
  if (blocks?.length) return { error: "cannotSend", params: { username } };

  // Balasan hanya boleh untuk surat yang sudah sampai ke kita, dan dikirim ke pengirimnya.
  if (replyTo) {
    const { data: original } = await admin
      .from("messages")
      .select("id, sender_id, recipient_id, arrive_at")
      .eq("id", replyTo)
      .maybeSingle();
    const valid =
      original &&
      original.recipient_id === me.id &&
      original.sender_id === them.id &&
      Date.parse(original.arrive_at) <= Date.now();
    if (!valid) return { error: "replyInvalid" };
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("sent_at", since);
  if (count >= MAX_PER_MINUTE) return { error: "rateLimited" };

  const from = { lat: Number(me.lat), lng: Number(me.lng), label: me.address_label };
  const to = { lat: Number(them.lat), lng: Number(them.lng), label: them.address_label };
  // Perjalanan dihitung di server dengan jam server, jadi waktu tiba tidak bisa diakali dari browser.
  const trip = makeTrip({ from, to, animalId, speedup, sentAt: Date.now() });

  const { data, error } = await admin
    .from("messages")
    .insert({
      sender_id: me.id,
      recipient_id: them.id,
      from_label: from.label,
      from_lat: from.lat,
      from_lng: from.lng,
      to_label: to.label,
      to_lat: to.lat,
      to_lng: to.lng,
      animal: animalId,
      reply_to: replyTo,
      body,
      sent_at: new Date(trip.sentAt).toISOString(),
      arrive_at: new Date(trip.sentAt + trip.durMs).toISOString(),
      distance_km: trip.distanceKm,
      speedup,
      events: trip.events,
    })
    .select("id")
    .single();

  if (error) return { error: "sendFailed" };
  // Disiarkan lewat Supabase Realtime supaya kotak masuk penerima langsung diperbarui.
  await admin.from("mail_events").insert({ user_id: them.id, message_id: data.id, kind: "incoming" });
  revalidatePath("/");
  return { id: data.id };
}

// Isi pesan hanya dikembalikan oleh database jika kurir sudah mendarat.
export async function openMessage(id) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_message", { message_id: id });
  if (error) return { error: "openFailed" };
  return { body: data };
}

export async function deleteMessage(id) {
  const supabase = await createClient();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) return { error: "deleteFailed" };
  revalidatePath("/");
  return { ok: true };
}

function sanitizeQuery(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^\p{L}\p{N} _]/gu, "")
    .trim()
    .slice(0, 30);
}

// Saran penerima: cocokkan awal username atau bagian nama tampilan.
export async function searchProfiles(rawQuery) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const q = sanitizeQuery(rawQuery).replace(/_/g, "\\_");
  if (!q) return { results: [] };

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, address_label")
    .or(`username.ilike.${q}%,display_name.ilike.%${q}%`)
    .neq("id", user.id)
    .order("username")
    .limit(6);
  return {
    results: (data ?? []).map((p) => ({ id: p.id, username: p.username, displayName: p.display_name, label: p.address_label })),
  };
}

export async function loadMoreTrips(box, before) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  if (!["inbox", "sent"].includes(box) || Number.isNaN(Date.parse(before))) return { rows: [], hasMore: false };
  const blockedIds = box === "inbox" ? await fetchBlockedIds(supabase, user.id) : [];
  const { rows, hasMore, error } = await fetchBox(supabase, user.id, box, { before, blockedIds });
  if (error) return { error: "loadFailed" };
  return { rows, hasMore };
}

export async function blockUser(userId) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  if (typeof userId !== "string" || userId === user.id) return { error: "blockFailed" };
  // insert biasa (bukan upsert): tabel blocks tidak memberi izin UPDATE. Duplikat berarti sudah diblokir.
  const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: userId });
  if (error && error.code !== "23505") return { error: "blockFailed" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unblockUser(userId) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  if (error) return { error: "blockFailed" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reportUser({ userId, messageId, reason } = {}) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const text = String(reason ?? "").trim().slice(0, 500);
  if (!text) return { error: "reportReason" };
  if (typeof userId !== "string" || userId === user.id) return { error: "reportFailed" };
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_id: userId,
    message_id: typeof messageId === "string" ? messageId : null,
    reason: text,
  });
  if (error) return { error: "reportFailed" };
  return { ok: true };
}

// Memastikan kata sandi saat ini benar sebelum mengubah hal sensitif.
async function verifyPassword(email, password) {
  const { error } = await createEphemeralClient().auth.signInWithPassword({ email, password: String(password ?? "") });
  return !error;
}

export async function changePassword(_prev, formData) {
  const { user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < MIN_PASSWORD) return { error: "passwordShort", params: { min: MIN_PASSWORD } };
  if (!(await verifyPassword(user.email, current))) return { error: "wrongPassword" };

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: next });
  if (error) return { error: "passwordChangeFailed" };
  return { ok: "passwordChanged" };
}

// Tanpa verifikasi email, sama seperti saat mendaftar.
export async function changeEmail(_prev, formData) {
  const { user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "invalidEmail" };
  if (email === user.email) return { ok: "emailChanged" };
  if (!(await verifyPassword(user.email, formData.get("password")))) return { error: "wrongPassword" };

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { email, email_confirm: true });
  if (error) {
    const exists = error.code === "email_exists" || /already/i.test(error.message);
    return { error: exists ? "emailExists" : "emailChangeFailed" };
  }
  // Sesi lama memuat email lama; masuk ulang supaya cookie memakai email baru.
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  revalidatePath("/", "layout");
  return { ok: "emailChanged" };
}

export async function deleteAccount(_prev, formData) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "sessionExpired" };
  if (!(await verifyPassword(user.email, formData.get("password")))) return { error: "wrongPassword" };

  // Profil, surat, blokir, dan event ikut terhapus lewat on delete cascade.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { error: "deleteAccountFailed" };
  await supabase.auth.signOut();
  redirect("/masuk");
}
