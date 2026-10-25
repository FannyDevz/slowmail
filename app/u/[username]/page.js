import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { INTL_LOCALE } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Halaman publik: hanya nama dan nama daerah, tanpa koordinat.
async function loadPublicProfile(username) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, display_name, address_label, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `@${username} · ${BRAND}` };
}

export default async function PublicProfilePage({ params }) {
  if (!hasSupabaseEnv()) notFound();
  const { username } = await params;
  const [person, { user, profile }, { locale, t }] = await Promise.all([
    loadPublicProfile(username),
    getSession(),
    getT(),
  ]);
  if (!person) notFound();

  const isMe = profile?.id === person.id;
  const since = new Intl.DateTimeFormat(INTL_LOCALE, { month: "long", year: "numeric" }).format(
    new Date(person.created_at),
  );
  const writeHref = user ? `/?to=${person.username}` : "/masuk";

  return (
    <main className="page page--medium">
      <SiteHeader profile={profile} signedIn={Boolean(user)} />
      <section className="card profile-card">
        <div className="profile-card__avatar" aria-hidden="true">{person.display_name.charAt(0).toUpperCase()}</div>
        <div className="profile-card__body">
          <h1>{person.display_name}</h1>
          <p className="profile-card__handle">@{person.username}</p>
          <p className="muted">📍 {person.address_label} · {t("public.joined", { date: since })}</p>
        </div>
        <div className="profile-card__actions">
          {isMe ? (
            <Link href="/profil" className="button">{t("public.edit")}</Link>
          ) : (
            <Link href={writeHref} className="button button--main">
              {user ? t("public.write", { username: person.username }) : t("public.signInToWrite")}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
