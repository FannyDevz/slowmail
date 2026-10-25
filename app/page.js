import { redirect } from "next/navigation";
import Mailroom from "@/components/Mailroom";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { isSimulationAllowed } from "@/lib/config";
import { getT } from "@/lib/i18n-server";
import { fetchBlockedIds, fetchBox } from "@/lib/messages";
import { tripFromRow } from "@/lib/pigeon";
import { getSession } from "@/lib/session";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/masuk");
  if (!profile) redirect("/profil");

  const [{ to }, { t }, blockedIds] = await Promise.all([searchParams, getT(), fetchBlockedIds(supabase, user.id)]);
  const [inbox, sent] = await Promise.all([
    fetchBox(supabase, user.id, "inbox", { blockedIds }),
    fetchBox(supabase, user.id, "sent"),
  ]);

  return (
    <main className="page">
      <SiteHeader profile={profile} signedIn />
      {(inbox.error || sent.error) && (
        <p className="notice notice--error" role="alert">{t("errors.loadFailed")}</p>
      )}
      <Mailroom
        inbox={inbox.rows.map(tripFromRow)}
        sent={sent.rows.map(tripFromRow)}
        hasMore={{ inbox: inbox.hasMore, sent: sent.hasMore }}
        me={{
          id: profile.id,
          username: profile.username,
          label: profile.address_label,
          lat: Number(profile.lat),
          lng: Number(profile.lng),
        }}
        initialTo={typeof to === "string" ? to : ""}
        serverNow={Date.now()}
        allowSimulation={isSimulationAllowed()}
      />
    </main>
  );
}
