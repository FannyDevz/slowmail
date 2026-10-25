"use client";

import { INTL_LOCALE, LOCALE, t } from "@/lib/i18n";

const value = { locale: LOCALE, intl: INTL_LOCALE, t };

// Satu bahasa, jadi tidak perlu context; hook ini tetap ada supaya komponen tidak perlu berubah.
export function useI18n() {
  return value;
}
