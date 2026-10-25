import { DM_Sans } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { getT } from "@/lib/i18n-server";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-dm-sans" });

export async function generateMetadata() {
  const { t } = await getT();
  return { title: BRAND, description: t("meta.description") };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5294ff",
};

export default async function RootLayout({ children }) {
  const { locale } = await getT();
  return (
    <html lang={locale} className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
