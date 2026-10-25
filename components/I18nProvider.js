"use client";

import { createContext, useContext, useMemo } from "react";
import { INTL_LOCALE, makeT } from "@/lib/i18n";

const I18nContext = createContext(null);

export function I18nProvider({ locale, children }) {
  const value = useMemo(() => ({ locale, intl: INTL_LOCALE[locale], t: makeT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
