"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { changeEmail, changePassword, deleteAccount, unblockUser } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

function Result({ state }) {
  const { t } = useI18n();
  if (!state) return null;
  if (state.error) return <p className="notice notice--error" role="alert">{t(`errors.${state.error}`, state.params)}</p>;
  return <p className="notice notice--ok" role="status">{t(`settings.${state.ok}`)}</p>;
}

function NotificationsPanel() {
  const { t } = useI18n();
  const [permission, setPermission] = useState(null);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  return (
    <section className="card stack" aria-labelledby="notif-title">
      <h2 id="notif-title">{t("settings.notificationsTitle")}</h2>
      <p className="muted">{t("notify.hint")}</p>
      {permission === "default" && (
        <button
          type="button"
          className="button button--accent settings__button"
          onClick={async () => setPermission(await Notification.requestPermission())}
        >
          🔔 {t("notify.enable")}
        </button>
      )}
      {permission === "granted" && <p className="notice notice--ok">{t("notify.enabled")}</p>}
      {permission === "denied" && <p className="notice">{t("notify.denied")}</p>}
      {permission === "unsupported" && <p className="notice">{t("notify.unsupported")}</p>}
    </section>
  );
}

function PasswordPanel() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <section className="card" aria-labelledby="password-title">
      <h2 id="password-title">{t("settings.passwordTitle")}</h2>
      <form className="stack" action={action}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="current-password">{t("settings.current")}</label>
            <input id="current-password" name="current" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="new-password">{t("settings.next")}</label>
            <input id="new-password" name="next" type="password" required minLength={8} autoComplete="new-password" />
            <small className="hint">{t("auth.passwordHint")}</small>
          </div>
        </div>
        <Result state={state} />
        <button type="submit" className="button button--main settings__button" disabled={pending}>
          {pending ? t("settings.saving") : t("settings.savePassword")}
        </button>
      </form>
    </section>
  );
}

function EmailPanel({ email }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changeEmail, null);
  return (
    <section className="card" aria-labelledby="email-title">
      <h2 id="email-title">{t("settings.emailTitle")}</h2>
      <form className="stack" action={action}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="new-email">{t("settings.newEmail")}</label>
            <input id="new-email" name="email" type="email" required autoComplete="email" defaultValue={email} />
          </div>
          <div className="field">
            <label htmlFor="email-password">{t("settings.current")}</label>
            <input id="email-password" name="password" type="password" required autoComplete="current-password" />
          </div>
        </div>
        <Result state={state} />
        <button type="submit" className="button button--main settings__button" disabled={pending}>
          {pending ? t("settings.saving") : t("settings.saveEmail")}
        </button>
      </form>
    </section>
  );
}

function BlockedPanel({ blocked }) {
  const { t } = useI18n();
  const [list, setList] = useState(blocked);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setList(blocked), [blocked]);

  return (
    <section className="card stack" aria-labelledby="blocked-title">
      <h2 id="blocked-title">{t("settings.blockedTitle")}</h2>
      {list.length === 0 ? (
        <p className="muted">{t("settings.noBlocked")}</p>
      ) : (
        <ul className="blocked-list">
          {list.map((b) => (
            <li key={b.id}>
              <span>
                <strong>@{b.username}</strong> <span className="muted">{b.displayName}</span>
              </span>
              <button
                type="button"
                className="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await unblockUser(b.id);
                    if (res.error) return setError(res.error);
                    setList((prev) => prev.filter((x) => x.id !== b.id));
                  })
                }
              >
                {t("settings.unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="notice notice--error" role="alert">{t(`errors.${error}`)}</p>}
    </section>
  );
}

function DangerPanel({ username }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(deleteAccount, null);
  const [confirm, setConfirm] = useState("");
  const matches = !username || confirm.trim().toLowerCase() === username;

  return (
    <section className="card card--danger" aria-labelledby="danger-title">
      <h2 id="danger-title">{t("settings.dangerTitle")}</h2>
      <p className="muted">{t("settings.dangerBody")}</p>
      <form className="stack" action={action}>
        <div className="field-row">
          {username && (
            <div className="field">
              <label htmlFor="confirm-username">{t("settings.confirmLabel", { username })}</label>
              <input
                id="confirm-username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="delete-password">{t("settings.current")}</label>
            <input id="delete-password" name="password" type="password" required autoComplete="current-password" />
          </div>
        </div>
        <Result state={state} />
        <button type="submit" className="button button--danger settings__button" disabled={pending || !matches}>
          {t("settings.deleteButton")}
        </button>
      </form>
    </section>
  );
}

export default function SettingsPanels({ email, username, blocked }) {
  return (
    <div className="profile-form">
      <NotificationsPanel />
      <PasswordPanel />
      <EmailPanel email={email} />
      <BlockedPanel blocked={blocked} />
      <DangerPanel username={username} />
    </div>
  );
}
