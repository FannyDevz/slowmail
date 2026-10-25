import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: `${t("meta.notFound")} · ${BRAND}` };
}

export default async function NotFound() {
  const { t } = await getT();
  const { user, profile } = hasSupabaseEnv() ? await getSession() : {};

  return (
    <main className="page page--narrow">
      <SiteHeader profile={profile} signedIn={Boolean(user)} />
      <section className="card not-found">
        <p className="not-found__code" aria-hidden="true">404</p>
        <h1>{t("notFound.title")}</h1>
        <p className="muted">{t("notFound.body")}</p>
        <Link href="/" className="button button--main">{t("notFound.back")}</Link>
      </section>
    </main>
  );
}
