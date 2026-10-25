"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { findRecipient, sendMessage } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import RecipientInput from "@/components/mail/RecipientInput";
import { ANIMALS, MIN_DISTANCE_KM, SPEEDUPS, formatDuration, formatSpeedup, haversineKm } from "@/lib/pigeon";

const LOOKUP_DELAY_MS = 400;

// Mencari @username saat diketik, untuk menampilkan tujuan dan perkiraan waktu.
function useRecipient(rawTo) {
  const [state, setState] = useState({ status: "empty" });
  const username = rawTo.trim().toLowerCase().replace(/^@/, "");

  useEffect(() => {
    if (username.length < 3) return setState({ status: "empty" });
    setState({ status: "loading" });
    let cancelled = false;
    const id = setTimeout(async () => {
      const res = await findRecipient(username);
      if (cancelled) return;
      if (res.recipient) setState({ status: "found", recipient: res.recipient });
      else setState({ status: res.error ? "error" : "missing", error: res.error });
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username]);

  return state;
}

export default function SendForm({ me, contacts, initialTo, replyTo, onCancelReply, onSent, allowSimulation }) {
  const { t, locale, intl } = useI18n();
  const [to, setTo] = useState(initialTo);
  const [animalId, setAnimalId] = useState("merpati");
  const [speedup, setSpeedup] = useState(1);
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef(null);
  const lookup = useRecipient(to);

  // Membalas: penerima dikunci ke pengirim surat asli.
  useEffect(() => {
    if (!replyTo) return;
    setTo(replyTo.username);
    setError(null);
    bodyRef.current?.focus({ preventScroll: true });
  }, [replyTo]);

  const animal = ANIMALS[animalId];
  const recipient = lookup.status === "found" ? lookup.recipient : null;

  const estimate = useMemo(() => {
    if (!recipient) return null;
    const km = Math.max(MIN_DISTANCE_KM, haversineKm(me, recipient));
    return { km, ms: (km / animal.kmh) * 3600000 };
  }, [me, recipient, animal]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!recipient) return setError({ message: t("mail.needRecipient") });
    if (!body.trim()) return setError({ message: t("mail.needBody") });
    setError(null);
    startTransition(async () => {
      const result = await sendMessage({ to: recipient.username, animalId, speedup, body, replyTo: replyTo?.id });
      if (result.error) return setError(result);
      setBody("");
      onSent(result.id);
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      {replyTo && (
        <div className="reply-banner">
          <span>↩ {t("mail.replyingTo", { who: `@${replyTo.username}` })}</span>
          <button type="button" className="link-button" onClick={onCancelReply}>{t("mail.cancelReply")}</button>
        </div>
      )}

      <div className="field">
        <label htmlFor="to">{t("mail.to")}</label>
        <RecipientInput
          value={to}
          onChange={setTo}
          contacts={contacts}
          readOnly={Boolean(replyTo)}
          describedBy="to-status"
          invalid={lookup.status === "missing"}
        />
        <small id="to-status" className="hint" aria-live="polite">
          {lookup.status === "loading" && t("mail.searching")}
          {lookup.status === "missing" && t("mail.notRegistered")}
          {lookup.status === "error" && t(`errors.${lookup.error}`)}
          {recipient && (
            <>
              <strong>{recipient.displayName}</strong> · 📍 {recipient.label}
              {recipient.id === me.id && ` ${t("mail.yourself")}`}
            </>
          )}
        </small>
      </div>

      <fieldset className="animals">
        <legend>{t("mail.courier")}</legend>
        {Object.values(ANIMALS).map((a) => (
          <label key={a.id} className="animal-option">
            <input type="radio" name="animal" value={a.id} checked={animalId === a.id} onChange={() => setAnimalId(a.id)} />
            <span className="animal-option__emoji" aria-hidden="true">{a.emoji}</span>
            <span className="animal-option__text">
              <strong>{t(`animals.${a.id}.name`)}</strong>
              <small>
                {a.kmh.toLocaleString(intl)} {t("mail.kmh")} · {t(`animals.${a.id}.note`)}
              </small>
            </span>
          </label>
        ))}
      </fieldset>

      {allowSimulation && (
        <div className="field">
          <label htmlFor="speed">{t("mail.speed")}</label>
          <select id="speed" value={speedup} onChange={(e) => setSpeedup(Number(e.target.value))}>
            {SPEEDUPS.map((s) => (
              <option key={s} value={s}>{s === 1 ? t("mail.realtime") : formatSpeedup(s, intl)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="body">{t("mail.message")}</label>
        <textarea
          id="body"
          ref={bodyRef}
          rows={6}
          required
          maxLength={5000}
          placeholder={t("mail.messagePlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <p className="estimate" aria-live="polite">
        {estimate ? (
          <>
            {t("mail.estimate", {
              km: estimate.km.toLocaleString(intl, { maximumFractionDigits: 0 }),
              dur: formatDuration(estimate.ms, locale),
            })}
            {speedup > 1 && <> {t("mail.estimateSim", { dur: formatDuration(estimate.ms / speedup, locale) })}</>}
            {t("mail.estimateTail")}
          </>
        ) : (
          t("mail.estimateEmpty")
        )}
      </p>

      {error && (
        <p className="notice notice--error" role="alert">
          {error.message ?? t(`errors.${error.error}`, error.params)}
        </p>
      )}

      <button type="submit" className="button button--main button--block" disabled={pending}>
        {pending ? t("mail.sending") : t("mail.send")}
      </button>
    </form>
  );
}
