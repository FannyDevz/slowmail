import Link from "next/link";
import { signOut } from "@/app/actions";
import { isSuperAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";

export default async function SiteHeader({ profile, signedIn }) {
  const { t } = await getT();
  // Tautan Voyager hanya untuk super admin; halamannya sendiri memeriksa ulang ke server Auth.
  const showAdmin = signedIn && isSuperAdmin((await getSession()).user);
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand__mark" aria-hidden="true">✉</span>
        {BRAND}
      </Link>
      <div className="site-header__end">
        {signedIn && (
          <nav className="site-nav" aria-label={t("nav.main")}>
            <Link href="/">{t("nav.mailbox")}</Link>
            <Link href="/profil">{profile ? `@${profile.username}` : t("nav.setupProfile")}</Link>
            <Link href="/pengaturan">{t("nav.settings")}</Link>
            {showAdmin && <Link href="/voyager">{t("nav.admin")}</Link>}
            <form action={signOut}>
              <button type="submit" className="link-button">{t("nav.signOut")}</button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
