import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, makeT, normalizeLocale } from "@/lib/i18n";

// Bahasa dari cookie; jika belum dipilih, tebak dari Accept-Language.
export async function getLocale() {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved) return normalizeLocale(saved);
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
