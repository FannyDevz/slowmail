"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { blockUser, deleteMessage, openMessage, reportUser } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import { ProgressBar, useHandle, useStatusText } from "@/components/mail/shared";
import { ANIMALS, formatDuration, formatSpeedup, getProgress, interpolate, tripState } from "@/lib/pigeon";

const FlightMap = dynamic(() => import("@/components/FlightMap"), {
  ssr: false,
  loading: () => <div className="map map--loading" />,
});

export default function TripDetail({ trip, now, mounted, me, thread, onSelectTrip, onReply, onOpened, onRemoved }) {
  const { t, locale, intl } = useI18n();
  const handle = useHandle();
  const statusText = useStatusText();
  const animal = ANIMALS[trip.animalId];
  const animalName = t(`animals.${trip.animalId}.name`);
  const { from, to } = trip;
  const progress = getProgress(trip, now);
  const state = tripState(trip, progress);
  const position = interpolate(from, to, state.dist);
  const landed = progress >= 1;
  const fast = trip.speedup > 1;
  const arriveAt = trip.sentAt + trip.durMs;
  const isMine = trip.senderId === me.id;
  const isIncoming = trip.recipientId === me.id && trip.senderId !== me.id && Boolean(trip.sender);

  const [letter, setLetter] = useState({ status: "idle" });
  const [busy, startAction] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(null);

  // Tanggal diformat di browser saja, supaya memakai zona waktu pengguna (server Vercel memakai UTC).
  const formatTime = (ms) =>
    mounted
      ? new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: fast ? "medium" : "short" }).format(new Date(ms))
      : "…";

  // Isi surat diminta ke server begitu kurir mendarat; server yang memutuskan boleh atau tidak.
  useEffect(() => {
    if (!landed || letter.status !== "idle") return;
    setLetter({ status: "loading" });
    openMessage(trip.id).then((res) => {
      if (res.error) setLetter({ status: "error", error: res.error });
      else if (res.body == null) setLetter({ status: "idle-retry" });
      else {
        setLetter({ status: "open", body: res.body });
        onOpened?.(trip.id);
      }
    });
  }, [landed, letter.status, trip.id, onOpened]);

  // Jam browser bisa sedikit lebih cepat dari server; coba lagi sebentar kemudian.
  useEffect(() => {
    if (letter.status !== "idle-retry") return;
    const id = setTimeout(() => setLetter({ status: "idle" }), 3000);
    return () => clearTimeout(id);
  }, [letter.status]);

  function handleDelete() {
    if (!window.confirm(t("detail.confirmDelete"))) return;
    startAction(async () => {
      const res = await deleteMessage(trip.id);
      if (res.error) setNotice({ error: res.error });
      else onRemoved({ messageId: trip.id });
    });
  }

  function handleBlock() {
    const who = handle(trip.sender);
    if (!window.confirm(t("detail.confirmBlock", { who }))) return;
    startAction(async () => {
      const res = await blockUser(trip.senderId);
      if (res.error) setNotice({ error: res.error });
      else onRemoved({ blockedId: trip.senderId });
    });
  }

  function handleReport(e) {
    e.preventDefault();
    startAction(async () => {
      const res = await reportUser({ userId: trip.senderId, messageId: trip.id, reason });
      if (res.error) return setNotice({ error: res.error });
      setReporting(false);
      setReason("");
      setNotice({ ok: t("detail.reported") });
    });
  }

  const heading = landed
    ? t("detail.landed", { animal: animalName })
    : state.pausedAt >= 0
      ? t("detail.paused", { animal: animalName })
      : t("detail.moving", { animal: animalName, verb: t(`animals.${trip.animalId}.verb`) });

  return (
    <section className="card detail" aria-labelledby="detail-title">
      <div className="detail__head">
        <h2 id="detail-title">
          <span aria-hidden="true">{animal.emoji}</span> {heading}
        </h2>
        <span className={`badge ${landed ? "badge--ok" : ""}`}>{Math.floor(progress * 100)}%</span>
      </div>

      <FlightMap
        from={from}
        to={to}
        position={position}
        emoji={animal.emoji}
        label={t("detail.mapLabel", { from: from.label, to: to.label, pct: Math.round(state.dist * 100) })}
      />

      <ProgressBar value={progress} label={t("mail.progress")} />

      <dl className="facts">
        <div><dt>{t("detail.from")}</dt><dd>{handle(trip.sender)}<small>{from.label}</small></dd></div>
        <div><dt>{t("detail.to")}</dt><dd>{handle(trip.recipient)}<small>{to.label}</small></dd></div>
        <div><dt>{t("detail.distance")}</dt><dd>{trip.distanceKm.toLocaleString(intl, { maximumFractionDigits: 0 })} km</dd></div>
        <div><dt>{t("detail.departed")}</dt><dd>{formatTime(trip.sentAt)}</dd></div>
        <div><dt>{landed ? t("detail.arrived") : t("detail.eta")}</dt><dd>{formatTime(arriveAt)}</dd></div>
        {fast && <div><dt>{t("detail.simulation")}</dt><dd>{formatSpeedup(trip.speedup, intl)}</dd></div>}
      </dl>

      <ol className="timeline">
        <li className="is-done">{t("detail.departedFrom", { place: from.label })}</li>
        {trip.events.map((e, i) => {
          const status = landed || i < state.passed ? "is-done" : state.pausedAt === i ? "is-now" : "";
          return (
            <li key={i} className={status}>
              {t(`events.${e.key}`)} <span className="timeline__meta">({formatDuration(e.hours * 3600000, locale)})</span>
            </li>
          );
        })}
        <li className={landed ? "is-done" : ""}>{t("detail.landedAt", { place: to.label })}</li>
      </ol>

      <div className={`letter ${letter.status === "open" ? "" : "letter--sealed"}`} aria-live="polite">
        {letter.status === "open" ? (
          <p className="letter__body">{letter.body}</p>
        ) : letter.status === "error" ? (
          <p>{t(`errors.${letter.error}`)}</p>
        ) : landed ? (
          <p>{t("detail.opening")}</p>
        ) : (
          <p>🔒 {t("detail.sealed", { dur: formatDuration(arriveAt - now, locale) })}</p>
        )}
      </div>

      {thread.length > 1 && (
        <nav className="thread" aria-labelledby="thread-title">
          <h3 id="thread-title">{t("detail.conversation")}</h3>
          <ol>
            {thread.map((item) => {
              const current = item.id === trip.id;
              const p = getProgress(item, now);
              const label = `${handle(item.sender)} → ${handle(item.recipient)}`;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="thread__item"
                    aria-current={current ? "true" : undefined}
                    onClick={() => !current && onSelectTrip(item.id)}
                  >
                    <span aria-hidden="true">{ANIMALS[item.animalId].emoji}</span>
                    <span className="thread__who">{current ? `${t("detail.thisLetter")} · ${label}` : label}</span>
                    <small>{statusText(item, now, p, tripState(item, p))}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {notice && (
        <p className={`notice ${notice.error ? "notice--error" : "notice--ok"}`} role="status">
          {notice.error ? t(`errors.${notice.error}`) : notice.ok}
        </p>
      )}

      {reporting && (
        <form className="report stack" onSubmit={handleReport}>
          <label htmlFor="report-reason">{t("detail.reportPrompt", { who: handle(trip.sender) })}</label>
          <textarea id="report-reason" rows={3} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="actions">
            <button type="submit" className="button button--danger" disabled={busy}>{t("detail.report", { who: handle(trip.sender) })}</button>
            <button type="button" className="link-button" onClick={() => setReporting(false)}>{t("notify.dismiss")}</button>
          </div>
        </form>
      )}

      <div className="actions detail__actions">
        {isIncoming && letter.status === "open" && (
          <button type="button" className="button button--main" onClick={() => onReply(trip)}>
            ↩ {t("detail.reply")}
          </button>
        )}
        {isMine && (
          <button type="button" className="link-button link-button--danger" onClick={handleDelete} disabled={busy}>
            {landed ? t("detail.deleteLanded") : t("detail.cancelSend")}
          </button>
        )}
        {isIncoming && (
          <details className="menu">
            <summary className="link-button">{t("detail.more")}</summary>
            <div className="menu__list">
              <button type="button" onClick={(e) => { e.currentTarget.closest("details").open = false; setReporting(true); }}>
                {t("detail.report", { who: handle(trip.sender) })}
              </button>
              <button type="button" className="danger" onClick={handleBlock} disabled={busy}>
                {t("detail.block", { who: handle(trip.sender) })}
              </button>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
