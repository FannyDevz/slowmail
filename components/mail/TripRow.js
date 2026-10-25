"use client";

import { useI18n } from "@/components/I18nProvider";
import { ANIMALS, getProgress, tripState } from "@/lib/pigeon";
import { ProgressBar, useHandle, useStatusText } from "@/components/mail/shared";

export default function TripRow({ trip, now, box, active, unread, onSelect }) {
  const { t } = useI18n();
  const handle = useHandle();
  const statusText = useStatusText();
  const animal = ANIMALS[trip.animalId];
  const progress = getProgress(trip, now);
  const state = tripState(trip, progress);
  const who = box === "inbox" ? trip.sender : trip.recipient;

  return (
    <li>
      <button
        type="button"
        className={`trip-row${unread ? " trip-row--unread" : ""}`}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="trip-row__emoji" aria-hidden="true">{animal.emoji}</span>
        <span className="trip-row__main">
          <span className="trip-row__title">
            <span className="trip-row__who">{t(box === "inbox" ? "mail.fromWho" : "mail.toWho", { who: handle(who) })}</span>
            {unread && <span className="tag tag--new">{t("mail.unreadBadge")}</span>}
            {trip.replyTo && <span className="tag">↩ {t("mail.replyBadge")}</span>}
          </span>
          <ProgressBar value={progress} label={t("mail.progress")} />
          <span className="trip-row__status">{statusText(trip, now, progress, state)}</span>
        </span>
      </button>
    </li>
  );
}
