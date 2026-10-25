"use client";

import { useI18n } from "@/components/I18nProvider";
import { formatDuration } from "@/lib/pigeon";

export function useHandle() {
  const { t } = useI18n();
  return (person) => (person ? `@${person.username}` : t("mail.deletedUser"));
}

export function useStatusText() {
  const { t, locale } = useI18n();
  return (trip, now, progress, state) => {
    if (progress >= 1) return t("mail.landed");
    const left = t("mail.arrivesIn", { dur: formatDuration(trip.sentAt + trip.durMs - now, locale) });
    if (state.pausedAt >= 0) return `${t(`events.${trip.events[state.pausedAt].key}`)} · ${left}`;
    return left;
  };
}

export function ProgressBar({ value, label }) {
  const pct = Math.round(value * 100);
  return (
    <span className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="progress__fill" style={{ width: `${value * 100}%` }} />
    </span>
  );
}

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Surat berikutnya dan sebelumnya dalam satu rantai balasan, diurutkan dari yang paling awal.
export function buildThread(trip, byId) {
  let root = trip;
  const seen = new Set([trip.id]);
  while (root.replyTo && byId.has(root.replyTo) && !seen.has(root.replyTo)) {
    root = byId.get(root.replyTo);
    seen.add(root.id);
  }
  const thread = [root];
  const ids = new Set([root.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of byId.values()) {
      if (t.replyTo && ids.has(t.replyTo) && !ids.has(t.id)) {
        thread.push(t);
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return thread.sort((a, b) => a.sentAt - b.sentAt);
}
