import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: `${t("meta.profile")} · ${BRAND}` };
}

export default async function ProfilePage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { user, profile } = await getSession();
  if (!user) redirect("/masuk");
  const { t } = await getT();

  return (
    <main className="page page--medium">
      <SiteHeader profile={profile} signedIn />
      <header className="page-head">
        <h1>{profile ? t("profile.titleEdit") : t("profile.titleNew")}</h1>
        <p className="muted">{profile ? t("profile.introEdit") : t("profile.introNew")}</p>
      </header>
      <ProfileForm
        email={user.email}
        initial={
          profile && {
            username: profile.username,
            displayName: profile.display_name,
            label: profile.address_label,
            lat: Number(profile.lat),
            lng: Number(profile.lng),
          }
        }
      />
    </main>
  );
}
