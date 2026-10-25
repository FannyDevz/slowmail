"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatDuration } from "@/lib/pigeon";

const MAX_TIMEOUT_MS = 2 ** 31 - 1; // batas setTimeout (sekitar 24,8 hari)
const FALLBACK_REFRESH_MS = 60_000;
const TOAST_MS = 9000;

function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Notifikasi selama aplikasi terbuka:
// - surat masuk mendarat → dijadwalkan di browser dari arriveAt (tidak perlu server)
// - surat baru dikirim ke kita → Supabase Realtime (tabel mail_events), lalu router.refresh()
// Jika tab tersembunyi dan izin diberikan, pakai notifikasi sistem; selain itu toast di halaman.
export function useMailNotifications({ me, inbox, router, onOpenTrip }) {
  const { t, locale } = useI18n();
  const [permission, setPermission] = useState("default");
  const [toasts, setToasts] = useState([]);
  const pendingIncoming = useRef(new Set());
  const notified = useRef(new Set());

  useEffect(() => {
    setPermission(supported() ? Notification.permission : "unsupported");
  }, []);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    ({ key, title, body, tripId }) => {
      if (notified.current.has(key)) return;
      notified.current.add(key);
      if (document.hidden && supported() && Notification.permission === "granted") {
        const n = new Notification(title, { body, tag: key, icon: "/icon.svg" });
        n.onclick = () => {
          window.focus();
          onOpenTrip(tripId);
          n.close();
        };
        return;
      }
      setToasts((list) => [...list.slice(-2), { id: key, title, body, tripId }]);
      setTimeout(() => dismiss(key), TOAST_MS);
    },
    [dismiss, onOpenTrip],
  );

  const animalName = useCallback((trip) => t(`animals.${trip.animalId}.name`), [t]);
  const who = useCallback((trip) => (trip.sender ? `@${trip.sender.username}` : t("mail.deletedUser")), [t]);

  // Jadwalkan notifikasi untuk setiap surat masuk yang masih di jalan.
  useEffect(() => {
    const timers = [];
    const now = Date.now();
    for (const trip of inbox) {
      const arriveAt = trip.sentAt + trip.durMs;
      const wait = arriveAt - now;
      if (wait <= 0 || wait > MAX_TIMEOUT_MS) continue;
      timers.push(
        setTimeout(() => {
          notify({
            key: `landed:${trip.id}`,
            title: t("notify.landedTitle", { who: who(trip) }),
            body: t("notify.landedBody", { animal: animalName(trip), place: trip.to.label }),
            tripId: trip.id,
          });
          router.refresh();
        }, wait + 500),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [inbox, notify, router, t, who, animalName]);

  // Surat baru yang dikabarkan Realtime, setelah muncul di daftar.
  useEffect(() => {
    for (const trip of inbox) {
      if (!pendingIncoming.current.has(trip.id)) continue;
      pendingIncoming.current.delete(trip.id);
      const left = trip.sentAt + trip.durMs - Date.now();
      // Dengan simulasi cepat, surat bisa sudah mendarat sebelum kabarnya sampai.
      notify(
        left > 1000
          ? {
              key: `incoming:${trip.id}`,
              title: t("notify.incomingTitle", { who: who(trip) }),
              body: t("notify.incomingBody", { animal: animalName(trip), dur: formatDuration(left, locale) }),
              tripId: trip.id,
            }
          : {
              key: `landed:${trip.id}`,
              title: t("notify.landedTitle", { who: who(trip) }),
              body: t("notify.landedBody", { animal: animalName(trip), place: trip.to.label }),
              tripId: trip.id,
            },
      );
    }
  }, [inbox, notify, t, who, animalName, locale]);

  // Langganan Realtime; polling jarang sebagai cadangan jika koneksi terputus.
  // Klien Supabase (sekitar 70 kB) dimuat terpisah setelah halaman tampil, supaya tidak memperlambat muat awal.
  useEffect(() => {
    let supabase;
    let channel;
    let cancelled = false;
    (async () => {
      const { getBrowserClient } = await import("@/lib/supabase/browser");
      if (cancelled) return;
      supabase = getBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`mail:${me.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "mail_events", filter: `user_id=eq.${me.id}` },
          (payload) => {
            if (payload.new?.message_id) pendingIncoming.current.add(payload.new.message_id);
            router.refresh();
          },
        )
        .subscribe();
    })();
    const poll = setInterval(() => router.refresh(), FALLBACK_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [me.id, router]);

  const requestPermission = useCallback(async () => {
    if (!supported()) return;
    setPermission(await Notification.requestPermission());
  }, []);

  return { permission, requestPermission, toasts, dismiss };
}
