"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";

const ONE_YEAR = 60 * 60 * 24 * 365;

export default function LanguageSwitch() {
  const router = useRouter();
  const { locale, t } = useI18n();

  function choose(next) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="lang-switch" role="group" aria-label={t("nav.language")}>
      {LOCALES.map((l) => (
        <button key={l} type="button" aria-pressed={l === locale} onClick={() => choose(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
