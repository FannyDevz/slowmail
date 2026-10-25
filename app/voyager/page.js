import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { isSuperAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/brand";
import { INTL_LOCALE } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { ANIMALS } from "@/lib/pigeon";
import { getSession } from "@/lib/session";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Voyager · ${BRAND}`, robots: { index: false, follow: false } };

const PER_PAGE = 50;

// Hanya huruf, angka, spasi, dan garis bawah, supaya aman dipakai di filter PostgREST.
function cleanQuery(raw) {
  return String(raw ?? "").toLowerCase().replace(/^@/, "").replace(/[^\p{L}\p{N} _]/gu, "").trim().slice(0, 40);
}

async function findProfileIds(admin, q) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(200);
  return (data ?? []).map((p) => p.id);
}

async function loadStats(admin) {
  const nowIso = new Date().toISOString();
  const [users, profiles, messages, flying] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("messages").select("id", { count: "exact", head: true }),
    admin.from("messages").select("id", { count: "exact", head: true }).gt("arrive_at", nowIso),
  ]);
  return {
    users: users.data?.total ?? users.data?.users?.length ?? 0,
    profiles: profiles.count ?? 0,
    messages: messages.count ?? 0,
    flying: flying.count ?? 0,
  };
}

async function loadUsers(admin, { q, page }) {
  const from = (page - 1) * PER_PAGE;
  let authUsers;
  let profiles;
  let hasMore;

  if (q) {
    // Cari lewat profil, lalu ambil data akunnya satu per satu (maksimal satu halaman).
    const { data } = await admin
      .from("profiles")
      .select("id, username, display_name, address_label, created_at")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .range(from, from + PER_PAGE);
    hasMore = (data ?? []).length > PER_PAGE;
    profiles = (data ?? []).slice(0, PER_PAGE);
    authUsers = (await Promise.all(profiles.map((p) => admin.auth.admin.getUserById(p.id)))).map((r) => r.data?.user).filter(Boolean);
  } else {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    authUsers = data?.users ?? [];
    hasMore = authUsers.length === PER_PAGE;
    const ids = authUsers.map((u) => u.id);
    const res = ids.length
      ? await admin.from("profiles").select("id, username, display_name, address_label, created_at").in("id", ids)
      : { data: [] };
    profiles = res.data ?? [];
  }

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const ids = authUsers.map((u) => u.id);
  const { data: counts } = ids.length ? await admin.rpc("admin_message_counts", { user_ids: ids }) : { data: [] };
  const countById = new Map((counts ?? []).map((c) => [c.user_id, c]));

  const rows = authUsers
    .map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      isAdmin: isSuperAdmin(u),
      profile: byId.get(u.id) ?? null,
      sent: Number(countById.get(u.id)?.sent ?? 0),
      received: Number(countById.get(u.id)?.received ?? 0),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { rows, hasMore };
}

async function loadMessages(admin, { q, page, status }) {
  const from = (page - 1) * PER_PAGE;
  const nowIso = new Date().toISOString();
  let query = admin
    .from("messages")
    .select(
      `id, animal, body, from_label, to_label, sent_at, arrive_at, read_at, reply_to, distance_km, speedup,
       sender:profiles!messages_sender_id_fkey(username), recipient:profiles!messages_recipient_id_fkey(username)`,
    )
    .order("sent_at", { ascending: false })
    .range(from, from + PER_PAGE);
  if (status === "flying") query = query.gt("arrive_at", nowIso);
  if (status === "landed") query = query.lte("arrive_at", nowIso);
  if (q) {
    const ids = await findProfileIds(admin, q);
    if (!ids.length) return { rows: [], hasMore: false };
    const list = `(${ids.join(",")})`;
    query = query.or(`sender_id.in.${list},recipient_id.in.${list}`);
  }
  const { data } = await query;
  return { rows: (data ?? []).slice(0, PER_PAGE), hasMore: (data ?? []).length > PER_PAGE };
}

function pageHref(params, changes) {
  const next = new URLSearchParams({ ...params, ...changes });
  for (const [k, v] of [...next.entries()]) if (!v || (k === "page" && v === "1")) next.delete(k);
  const s = next.toString();
  return s ? `/voyager?${s}` : "/voyager";
}

export default async function VoyagerPage({ searchParams }) {
  if (!hasSupabaseEnv()) notFound();
  const { supabase, profile } = await getSession();
  // Data paling sensitif: cek peran langsung ke server Auth (bukan dari JWT), supaya pencabutan peran langsung berlaku.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Bukan super admin (atau belum masuk): pura-pura halaman ini tidak ada.
  if (!isSuperAdmin(user)) notFound();

  const sp = await searchParams;
  const tab = sp.tab === "messages" ? "messages" : "users";
  const q = cleanQuery(sp.q);
  const page = Math.max(1, Number.parseInt(sp.page, 10) || 1);
  const status = ["flying", "landed"].includes(sp.status) ? sp.status : "";
  const params = { tab, q, status, page: String(page) };

  const admin = createAdminClient();
  const { t, locale } = await getT();
  const [stats, list] = await Promise.all([
    loadStats(admin),
    tab === "users" ? loadUsers(admin, { q, page }) : loadMessages(admin, { q, page, status }),
  ]);

  const intl = INTL_LOCALE;
  const fmt = (iso) =>
    iso
      ? new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso))
      : t("admin.never");
  const num = (n) => Number(n).toLocaleString(intl);
  const now = Date.now();

  return (
    <main className="page">
      <SiteHeader profile={profile} signedIn />
      <header className="page-head">
        <h1>{t("admin.title")}</h1>
        <p className="muted">{t("admin.subtitle")}</p>
      </header>

      <dl className="stats">
        <div><dt>{t("admin.statUsers")}</dt><dd>{num(stats.users)}</dd></div>
        <div><dt>{t("admin.statProfiles")}</dt><dd>{num(stats.profiles)}</dd></div>
        <div><dt>{t("admin.statMessages")}</dt><dd>{num(stats.messages)}</dd></div>
        <div><dt>{t("admin.statFlying")}</dt><dd>{num(stats.flying)}</dd></div>
      </dl>

      <section className="card stack">
        <nav className="segmented" aria-label={t("admin.title")}>
          <Link href={pageHref({}, { tab: "users" })} aria-current={tab === "users" ? "page" : undefined}>{t("admin.users")}</Link>
          <Link href={pageHref({}, { tab: "messages" })} aria-current={tab === "messages" ? "page" : undefined}>{t("admin.messages")}</Link>
        </nav>

        <form className="admin-filters" action="/voyager">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="admin-q" className="sr-only">{t("admin.search")}</label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={tab === "users" ? t("admin.searchUsers") : t("admin.searchMessages")}
          />
          {tab === "messages" && (
            <select name="status" defaultValue={status} aria-label={t("admin.colStatus")}>
              <option value="">{t("admin.filterAll")}</option>
              <option value="flying">{t("admin.filterFlying")}</option>
              <option value="landed">{t("admin.filterLanded")}</option>
            </select>
          )}
          <button type="submit" className="button">{t("admin.search")}</button>
        </form>

        {list.rows.length === 0 ? (
          <p className="empty">{t("admin.empty")}</p>
        ) : tab === "users" ? (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.colUser")}</th>
                  <th>{t("admin.colEmail")}</th>
                  <th>{t("admin.colArea")}</th>
                  <th>{t("admin.colSentReceived")}</th>
                  <th>{t("admin.colJoined")}</th>
                  <th>{t("admin.colLastSeen")}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.profile ? (
                        <>
                          <Link href={`/u/${u.profile.username}`}><strong>@{u.profile.username}</strong></Link>
                          <small>{u.profile.display_name}</small>
                        </>
                      ) : (
                        <small className="muted">{t("admin.noProfile")}</small>
                      )}
                      {u.isAdmin && <span className="tag">{t("admin.adminBadge")}</span>}
                    </td>
                    <td className="admin-table__email">{u.email}</td>
                    <td>{u.profile?.address_label ?? "—"}</td>
                    <td className="admin-table__num">
                      {num(u.sent)} / {num(u.received)}
                      {u.profile && u.sent + u.received > 0 && (
                        <small>
                          <Link href={pageHref({}, { tab: "messages", q: u.profile.username })}>{t("admin.viewMessages")}</Link>
                        </small>
                      )}
                    </td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>{fmt(u.lastSignInAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.colSent")}</th>
                  <th>{t("admin.colRoute")}</th>
                  <th>{t("admin.colCourier")}</th>
                  <th>{t("admin.colStatus")}</th>
                  <th>{t("admin.colBody")}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((m) => {
                  const flying = Date.parse(m.arrive_at) > now;
                  return (
                    <tr key={m.id}>
                      <td>{fmt(m.sent_at)}</td>
                      <td>
                        <strong>@{m.sender?.username ?? "?"}</strong> → <strong>@{m.recipient?.username ?? "?"}</strong>
                        {m.reply_to && <span className="tag">↩ {t("admin.reply")}</span>}
                        <small>{m.from_label} → {m.to_label} · {num(Math.round(m.distance_km))} km</small>
                      </td>
                      <td>
                        {ANIMALS[m.animal]?.emoji} {t(`animals.${m.animal}.name`)}
                        {m.speedup > 1 && <small>{num(m.speedup)}x</small>}
                      </td>
                      <td>
                        <span className={`badge ${flying ? "" : "badge--ok"}`}>
                          {flying
                            ? t("admin.flying", { time: fmt(m.arrive_at) })
                            : m.read_at
                              ? t("admin.landedRead", { time: fmt(m.read_at) })
                              : t("admin.landedUnread")}
                        </span>
                      </td>
                      <td className="admin-table__body">
                        <details>
                          <summary>{t("admin.showBody")}</summary>
                          <p>{m.body}</p>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(page > 1 || list.hasMore) && (
          <nav className="pager" aria-label={t("admin.page", { page })}>
            {page > 1 ? <Link className="button" href={pageHref(params, { page: String(page - 1) })}>← {t("admin.prev")}</Link> : <span />}
            <span className="muted">{t("admin.page", { page })}</span>
            {list.hasMore ? <Link className="button" href={pageHref(params, { page: String(page + 1) })}>{t("admin.next")} →</Link> : <span />}
          </nav>
        )}
      </section>
    </main>
  );
}
