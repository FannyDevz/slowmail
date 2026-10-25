"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadMoreTrips } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import SendForm from "@/components/mail/SendForm";
import Toasts from "@/components/mail/Toasts";
import TripDetail from "@/components/mail/TripDetail";
import TripRow from "@/components/mail/TripRow";
import { buildThread, reducedMotion } from "@/components/mail/shared";
import { useMailNotifications } from "@/components/mail/useMailNotifications";
import { BRAND } from "@/lib/brand";
import { tripFromRow } from "@/lib/pigeon";

const MOBILE_QUERY = "(max-width: 919px)";

function mergeTrips(fresh, older) {
  const seen = new Set(fresh.map((t) => t.id));
  return [...fresh, ...older.filter((t) => !seen.has(t.id))];
}

export default function Mailroom({ inbox: freshInbox, sent: freshSent, hasMore: initialHasMore, contacts, me, initialTo, serverNow, allowSimulation }) {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState("inbox");
  const [selectedId, setSelectedId] = useState(null);
  // Mulai dari jam server supaya render pertama sama persis dengan HTML dari server (tanpa hydration mismatch).
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  // Di HP hanya satu panel yang tampil: form tulis atau daftar surat.
  const [view, setView] = useState(initialTo ? "compose" : "mail");
  const [older, setOlder] = useState({ inbox: [], sent: [] });
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, startLoadMore] = useTransition();
  const [readLocally, setReadLocally] = useState(() => new Set());
  const detailRef = useRef(null);
  const composeRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const inbox = useMemo(() => mergeTrips(freshInbox, older.inbox), [freshInbox, older.inbox]);
  const sent = useMemo(() => mergeTrips(freshSent, older.sent), [freshSent, older.sent]);
  const byId = useMemo(() => new Map([...inbox, ...sent].map((tr) => [tr.id, tr])), [inbox, sent]);
  const list = tab === "inbox" ? inbox : sent;
  const selected = selectedId ? byId.get(selectedId) : null;

  const isUnread = (trip) =>
    trip.recipientId === me.id && !trip.readAt && !readLocally.has(trip.id) && now >= trip.sentAt + trip.durMs;
  const unreadCount = inbox.filter(isUnread).length;

  useEffect(() => {
    document.title = unreadCount ? `(${unreadCount}) ${BRAND}` : BRAND;
  }, [unreadCount]);

  function scrollIntoView(ref, onlyMobile) {
    if (onlyMobile && !window.matchMedia(MOBILE_QUERY).matches) return;
    requestAnimationFrame(() =>
      ref.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }),
    );
  }

  const showTrip = useCallback(
    (id) => {
      const trip = byId.get(id);
      if (trip) setTab(trip.recipientId === me.id ? "inbox" : "sent");
      setSelectedId(id);
      setView("mail");
      scrollIntoView(detailRef, true);
    },
    [byId, me.id],
  );

  const { permission, requestPermission, toasts, dismiss } = useMailNotifications({ me, inbox, router, onOpenTrip: showTrip });

  const markRead = useCallback((id) => setReadLocally((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), []);

  function startReply(trip) {
    setReplyTo({ id: trip.id, username: trip.sender.username });
    setView("compose");
    scrollIntoView(composeRef, false);
  }

  function handleSent(id) {
    setReplyTo(null);
    setTab("sent");
    setSelectedId(id);
    setView("mail");
    setNow(Date.now());
  }

  // Surat lama yang dimuat lewat "muat lebih banyak" ada di state lokal, jadi ikut dibersihkan di sini;
  // halaman pertama diperbarui dari server lewat router.refresh().
  function handleRemoved({ messageId, blockedId }) {
    const keep = (trip) => trip.id !== messageId && trip.senderId !== blockedId;
    setOlder((prev) => ({ inbox: prev.inbox.filter(keep), sent: prev.sent.filter(keep) }));
    setSelectedId(null);
    router.refresh();
  }

  function loadMore() {
    const box = tab;
    const last = list[list.length - 1];
    if (!last) return;
    startLoadMore(async () => {
      const res = await loadMoreTrips(box, new Date(last.sentAt).toISOString());
      if (res.error) return;
      setOlder((prev) => ({ ...prev, [box]: [...prev[box], ...res.rows.map(tripFromRow)] }));
      setHasMore((prev) => ({ ...prev, [box]: res.hasMore }));
    });
  }

  return (
    <>
      <div className="segmented view-switch" role="tablist" aria-label={t("mail.viewSwitch")}>
        <button type="button" role="tab" aria-selected={view === "mail"} onClick={() => setView("mail")}>
          {t("mail.viewMail")} {unreadCount > 0 && <span className="count count--new">{unreadCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={view === "compose"} onClick={() => setView("compose")}>
          ✎ {t("mail.viewCompose")}
        </button>
      </div>

      <div className="layout" data-view={view}>
        <section className="card compose" aria-labelledby="send-title" ref={composeRef}>
          <div className="airmail" aria-hidden="true" />
          <h2 id="send-title">{replyTo ? t("mail.replyTitle") : t("mail.composeTitle")}</h2>
          <p className="muted compose__from">
            📍 {t("mail.sentFrom", { place: me.label })} · <Link href="/profil">{t("mail.change")}</Link>
          </p>
          <SendForm
            me={me}
            contacts={contacts}
            initialTo={initialTo}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSent={handleSent}
            allowSimulation={allowSimulation}
          />
        </section>

        <div className="journeys">
          <section className="card" aria-label={t("mail.boxes")}>
            {mounted && permission === "default" && (
              <div className="notify-prompt">
                <span>🔔 {t("notify.hint")}</span>
                <button type="button" className="button button--accent" onClick={requestPermission}>
                  {t("notify.enable")}
                </button>
              </div>
            )}

            <div className="segmented" role="tablist" aria-label={t("mail.chooseBox")}>
              <TabButton id="inbox" current={tab} onSelect={setTab} count={inbox.length} unread={unreadCount}>
                {t("mail.inbox")}
              </TabButton>
              <TabButton id="sent" current={tab} onSelect={setTab} count={sent.length}>
                {t("mail.sent")}
              </TabButton>
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === "inbox" && unreadCount > 0 && (
                <p className="hint unread-summary">{t("mail.unreadCount", { n: unreadCount })}</p>
              )}
              {list.length === 0 ? (
                <p className="empty">
                  {tab === "inbox" ? (
                    <>
                      {t("mail.emptyInbox")} <Link href={`/u/${me.username}`}>@{me.username}</Link>
                    </>
                  ) : (
                    t("mail.emptySent")
                  )}
                </p>
              ) : (
                <ul className="trips">
                  {list.map((trip) => (
                    <TripRow
                      key={trip.id}
                      trip={trip}
                      now={now}
                      box={tab}
                      unread={isUnread(trip)}
                      active={selected?.id === trip.id}
                      onSelect={() => showTrip(trip.id)}
                    />
                  ))}
                </ul>
              )}
              {hasMore[tab] && (
                <button type="button" className="button button--block load-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t("mail.loadingMore") : t("mail.loadMore")}
                </button>
              )}
            </div>
          </section>

          <div ref={detailRef} className="detail-anchor">
            {selected ? (
              <TripDetail
                key={selected.id}
                trip={selected}
                now={now}
                mounted={mounted}
                me={me}
                thread={buildThread(selected, byId)}
                onSelectTrip={showTrip}
                onReply={startReply}
                onOpened={markRead}
                onRemoved={handleRemoved}
              />
            ) : (
              list.length > 0 && <p className="card detail-placeholder">{t("mail.pickLetter")}</p>
            )}
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} onOpen={showTrip} onDismiss={dismiss} />
    </>
  );
}

function TabButton({ id, current, onSelect, count, unread, children }) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={current === id}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
    >
      {children} <span className={`count${unread ? " count--new" : ""}`}>{unread || count}</span>
    </button>
  );
}
