import { redirect } from "next/navigation";
import SettingsPanels from "@/components/SettingsPanels";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: `${t("meta.settings")} · ${BRAND}` };
}

export default async function SettingsPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/masuk");
  const { t } = await getT();

  const { data: blocks } = await supabase
    .from("blocks")
    .select("blocked_id, blocked:profiles!blocks_blocked_id_fkey(username, display_name)")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="page page--medium">
      <SiteHeader profile={profile} signedIn />
      <header className="page-head">
        <h1>{t("settings.title")}</h1>
        <p className="muted">{t("settings.signedInAs", { email: user.email })}</p>
      </header>
      <SettingsPanels
        email={user.email}
        username={profile?.username ?? ""}
        blocked={(blocks ?? []).map((b) => ({ id: b.blocked_id, username: b.blocked?.username, displayName: b.blocked?.display_name }))}
      />
    </main>
  );
}
