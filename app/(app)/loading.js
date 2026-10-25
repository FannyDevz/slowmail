import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";

// Tampil seketika saat berpindah halaman, sementara server mengambil data.
export default function Loading() {
  return (
    <main className="page" aria-busy="true">
      <header className="site-header">
        <span className="brand">
          <span className="brand__mark" aria-hidden="true">✉</span>
          {BRAND}
        </span>
      </header>
      <div className="skeleton" role="status">
        <span className="sr-only">{t("common.loading")}</span>
        <div className="skeleton__block skeleton__block--title" />
        <div className="skeleton__block" />
        <div className="skeleton__block skeleton__block--short" />
      </div>
    </main>
  );
}
