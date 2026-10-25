import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: `${t("meta.signIn")} · ${BRAND}` };
}

export default async function LoginPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { user } = await getSession();
  if (user) redirect("/");
  const { t } = await getT();

  return (
    <main className="page page--narrow">
      <SiteHeader />
      <section className="hero">
        <h1>{t("auth.heroTitle")}</h1>
        <p>{t("auth.heroBody")}</p>
      </section>
      <AuthForm />
    </main>
  );
}
