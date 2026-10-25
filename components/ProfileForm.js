"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import { getCurrentPosition, reverseGeocode, searchPlaces } from "@/lib/geocode";
import { CITIES, roundCoord } from "@/lib/pigeon";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="map map--picker map--loading" />,
});

const GEO_ERRORS = { 1: "profile.geoDenied", 2: "profile.geoUnavailable", 3: "profile.geoTimeout" };

function suggestUsername(email) {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export default function ProfileForm({ email, initial }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState(initial?.username ?? suggestUsername(email));
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [point, setPoint] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [locStatus, setLocStatus] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();

  // Titik baru: isi nama daerah otomatis dari reverse geocoding (masih bisa diedit).
  async function pick(p, knownLabel) {
    setPoint(p);
    setSaved("");
    if (knownLabel) {
      setLocStatus("");
      return setLabel(knownLabel);
    }
    setLocStatus(t("profile.findingArea"));
    try {
      const found = await reverseGeocode(p.lat, p.lng, locale);
      if (found) setLabel(found);
      setLocStatus("");
    } catch {
      setLocStatus(t("profile.areaNotFound"));
    }
  }

  async function detect() {
    setLocStatus(t("profile.detecting"));
    setResults(null);
    try {
      await pick(await getCurrentPosition());
    } catch (err) {
      setLocStatus(t(GEO_ERRORS[err?.code] ?? "profile.geoUnsupported"));
    }
  }

  async function search(e) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setLocStatus(t("profile.searching"));
    try {
      const found = await searchPlaces(query.trim(), locale);
      setResults(found);
      setLocStatus(found.length ? "" : t("profile.noResults"));
    } catch {
      setLocStatus(t("profile.searchFailed"));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveProfile({ username, displayName, label, lat: point?.lat, lng: point?.lng });
      if (res.error) return setError(res);
      if (!initial) return router.push("/");
      setSaved(res.username);
      router.refresh();
    });
  }

  return (
    <div className="profile-form">
      <form id="profile-form" onSubmit={handleSubmit} />

      <section className="card stack" aria-labelledby="identity-title">
        <h2 id="identity-title">{t("profile.identity")}</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="username">{t("profile.username")}</label>
            <div className="input-prefix">
              <span aria-hidden="true">@</span>
              <input
                id="username"
                form="profile-form"
                required
                pattern="[a-z0-9_]{3,20}"
                maxLength={20}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                aria-describedby="username-hint"
              />
            </div>
            <small id="username-hint" className="hint">{t("profile.usernameHint")}</small>
          </div>
          <div className="field">
            <label htmlFor="display-name">{t("profile.displayName")}</label>
            <input
              id="display-name"
              form="profile-form"
              required
              maxLength={40}
              autoComplete="name"
              placeholder={t("profile.displayNamePlaceholder")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card stack" aria-labelledby="address-title">
        <div>
          <h2 id="address-title">{t("profile.address")}</h2>
          <p className="muted">{t("profile.addressIntro")}</p>
        </div>

        <div className="locate">
          <button type="button" className="button button--accent locate__detect" onClick={detect}>
            <span aria-hidden="true">📍</span> {t("profile.detect")}
          </button>
          <span className="locate__or">{t("profile.or")}</span>
          <form className="search" onSubmit={search} role="search">
            <label htmlFor="place-search" className="sr-only">{t("profile.searchLabel")}</label>
            <input
              id="place-search"
              type="search"
              enterKeyHint="search"
              placeholder={t("profile.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="button">{t("profile.search")}</button>
          </form>
        </div>

        {locStatus && <p className="hint" role="status">{locStatus}</p>}

        {results?.length > 0 && (
          <ul className="results">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setResults(null);
                    pick({ lat: r.lat, lng: r.lng }, r.label);
                  }}
                >
                  <strong>{r.label}</strong>
                  <small>{r.detail}</small>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="picker">
          <LocationPicker value={point} onPick={(p) => pick(p)} />
          <p className="hint">{t("profile.mapHint")}</p>
        </div>

        <details className="quick-cities">
          <summary>{t("profile.quickCities")}</summary>
          <div className="chips">
            {CITIES.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => pick({ lat: c.lat, lng: c.lng }, c.name)}>
                {c.name}
              </button>
            ))}
          </div>
        </details>

        <div className="field">
          <label htmlFor="area-label">{t("profile.areaLabel")}</label>
          <input
            id="area-label"
            form="profile-form"
            required
            maxLength={80}
            placeholder={t("profile.areaPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <small className="hint">
            {point
              ? t("profile.pointInfo", { lat: roundCoord(point.lat).toFixed(2), lng: roundCoord(point.lng).toFixed(2) })
              : t("profile.noPoint")}
          </small>
        </div>
      </section>

      <div className="save-bar">
        {error && <p className="notice notice--error" role="alert">{t(`errors.${error.error}`, error.params)}</p>}
        {saved && (
          <p className="notice notice--ok" role="status">
            {t("profile.saved", { username: saved })} <Link href={`/u/${saved}`}>{t("profile.viewPublic")}</Link>
          </p>
        )}
        <div className="actions">
          <button type="submit" form="profile-form" className="button button--main" disabled={pending}>
            {pending ? t("profile.saving") : initial ? t("profile.save") : t("profile.saveNew")}
          </button>
          {initial && <Link href="/" className="button">{t("profile.back")}</Link>}
        </div>
      </div>
    </div>
  );
}
