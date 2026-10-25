import { LOCALE, t } from "@/lib/i18n";

// Satu bahasa (Inggris); dibuat async supaya pemanggil di server tidak perlu berubah.
export async function getT() {
  return { locale: LOCALE, t };
}
