"use client";

import { useI18n } from "@/components/I18nProvider";

export default function Toasts({ toasts, onOpen, onDismiss }) {
  const { t } = useI18n();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <strong>{toast.title}</strong>
          <p>{toast.body}</p>
          <div className="toast__actions">
            <button
              type="button"
              className="button button--main"
              onClick={() => {
                onOpen(toast.tripId);
                onDismiss(toast.id);
              }}
            >
              {t("notify.open")}
            </button>
            <button type="button" className="link-button" onClick={() => onDismiss(toast.id)}>
              {t("notify.dismiss")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
