"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

export default function AuthForm() {
  const { t } = useI18n();
  const [mode, setMode] = useState("masuk");
  const [signInState, signInAction, signingIn] = useActionState(signIn, null);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null);

  const isSignUp = mode === "daftar";
  const state = isSignUp ? signUpState : signInState;
  const pending = isSignUp ? signingUp : signingIn;

  return (
    <section className="card auth-card" aria-label={isSignUp ? t("auth.signUp") : t("auth.signIn")}>
      <div className="segmented" role="tablist" aria-label={t("auth.choose")}>
        <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => setMode("masuk")}>{t("auth.signIn")}</button>
        <button type="button" role="tab" aria-selected={isSignUp} onClick={() => setMode("daftar")}>{t("auth.signUp")}</button>
      </div>

      <form className="stack" action={isSignUp ? signUpAction : signInAction} key={mode}>
        <div className="field">
          <label htmlFor="auth-email">{t("auth.email")}</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            defaultValue={state?.email ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">{t("auth.password")}</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            required
            minLength={isSignUp ? 8 : undefined}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
          {isSignUp && <small className="hint">{t("auth.passwordHint")}</small>}
        </div>
        {state?.error && <p className="notice notice--error" role="alert">{t(`errors.${state.error}`, state.params)}</p>}
        <button type="submit" className="button button--main button--block" disabled={pending}>
          {pending ? t("auth.pending") : isSignUp ? t("auth.submitSignUp") : t("auth.submitSignIn")}
        </button>
      </form>
    </section>
  );
}
