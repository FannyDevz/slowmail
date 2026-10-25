import SiteHeader from "@/components/SiteHeader";
import { getT } from "@/lib/i18n-server";

export default async function SetupNotice() {
  const { t } = await getT();
  const [before, middle, after] = t("setup").split(/\{example\}|\{local\}/);
  return (
    <main className="page">
      <SiteHeader />
      <p className="notice">
        {before}<code>.env.example</code>{middle}<code>.env.local</code>{after}
      </p>
    </main>
  );
}
