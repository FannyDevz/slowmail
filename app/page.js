"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ANIMALS,
  CITIES,
  SPEEDUPS,
  cityById,
  formatDuration,
  formatSpeedup,
  getProgress,
  haversineKm,
  interpolate,
  makeTrip,
  tripState,
} from "@/lib/pigeon";

const FlightMap = dynamic(() => import("@/components/FlightMap"), {
  ssr: false,
  loading: () => <div className="map map--loading">Memuat peta…</div>,
});

const STORAGE_KEY = "merpati-mail:v1";

function loadTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTrips(trips) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // penyimpanan penuh atau diblokir; perjalanan tetap jalan selama tab terbuka
  }
}

function formatTime(ms, withSeconds) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: withSeconds ? "medium" : "short",
  }).format(new Date(ms));
}

export default function Home() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setTrips(loadTrips());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveTrips(trips);
  }, [trips, loaded]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const selected = trips.find((t) => t.id === selectedId) ?? trips[0];

  function handleSend(trip) {
    setTrips((prev) => [trip, ...prev]);
    setSelectedId(trip.id);
    setNow(Date.now());
  }

  function handleDelete(id) {
    if (!window.confirm("Hapus perjalanan ini? Pesannya ikut hilang.")) return;
    setTrips((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Merpati Mail</h1>
        <p>Surat yang tidak terburu-buru. Pesanmu baru bisa dibuka setelah kurirnya mendarat.</p>
      </header>

      <div className="layout">
        <section className="envelope" aria-labelledby="send-title">
          <div className="envelope__inner">
            <h2 id="send-title">Tulis surat</h2>
            <SendForm onSend={handleSend} />
          </div>
        </section>

        <div className="journeys">
          <section aria-labelledby="trips-title">
            <h2 id="trips-title">Perjalanan</h2>
            {loaded && trips.length === 0 && (
              <p className="empty">Belum ada kurir di udara. Tulis surat pertamamu di samping.</p>
            )}
            {trips.length > 0 && (
              <ul className="trips">
                {trips.map((trip) => (
                  <TripRow
                    key={trip.id}
                    trip={trip}
                    now={now}
                    active={selected?.id === trip.id}
                    onSelect={() => setSelectedId(trip.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {selected && <TripDetail trip={selected} now={now} onDelete={() => handleDelete(selected.id)} />}
        </div>
      </div>
    </main>
  );
}

function SendForm({ onSend }) {
  const [recipient, setRecipient] = useState("");
  const [petName, setPetName] = useState("");
  const [fromId, setFromId] = useState("jakarta");
  const [toId, setToId] = useState("surabaya");
  const [animalId, setAnimalId] = useState("merpati");
  const [speedup, setSpeedup] = useState(1);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const animal = ANIMALS[animalId];
  const sameCity = fromId === toId;

  const estimate = useMemo(() => {
    if (sameCity) return null;
    const km = haversineKm(cityById(fromId), cityById(toId));
    return { km: Math.round(km), ms: (km / animal.kmh) * 3600000 };
  }, [fromId, toId, animal, sameCity]);

  function handleSubmit(e) {
    e.preventDefault();
    if (sameCity) return setError("Kota asal dan tujuan harus berbeda.");
    if (!body.trim()) return setError("Tulis isi pesannya dulu.");
    setError("");
    onSend(makeTrip({ fromId, toId, animalId, petName, recipient, body: body.trim(), speedup, sentAt: Date.now() }));
    setBody("");
  }

  return (
    <form className="send-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="recipient">Untuk</label>
        <input
          id="recipient"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@contoh.com"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="from">Dari kota</label>
          <select id="from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="to">Ke kota</label>
          <select id="to" value={toId} onChange={(e) => setToId(e.target.value)} aria-invalid={sameCity}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="animals">
        <legend>Kurir</legend>
        {Object.values(ANIMALS).map((a) => (
          <label key={a.id} className="animal-option">
            <input
              type="radio"
              name="animal"
              value={a.id}
              checked={animalId === a.id}
              onChange={() => setAnimalId(a.id)}
            />
            <span className="animal-option__emoji" aria-hidden="true">{a.emoji}</span>
            <span className="animal-option__text">
              <strong>{a.name}</strong>
              <small>{a.kmh.toLocaleString("id-ID")} km/jam · {a.note}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="field-row">
        <div className="field">
          <label htmlFor="pet">Nama kurir</label>
          <input
            id="pet"
            type="text"
            maxLength={30}
            placeholder={animal.defaultName}
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="speed">Kecepatan simulasi</label>
          <select id="speed" value={speedup} onChange={(e) => setSpeedup(Number(e.target.value))}>
            {SPEEDUPS.map((s) => (
              <option key={s} value={s}>{s === 1 ? "Waktu nyata" : formatSpeedup(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="body">Pesan</label>
        <textarea
          id="body"
          rows={6}
          required
          maxLength={5000}
          placeholder="Tidak perlu buru-buru…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <p className="estimate" aria-live="polite">
        {estimate ? (
          <>
            {estimate.km.toLocaleString("id-ID")} km, sekitar {formatDuration(estimate.ms)}
            {speedup > 1 && <> (simulasi: {formatDuration(estimate.ms / speedup)})</>}, belum termasuk waktu mampir.
          </>
        ) : (
          "Pilih dua kota yang berbeda."
        )}
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button type="submit" className="button-primary">Lepas kurir</button>
    </form>
  );
}

function statusText(trip, now, progress, state) {
  if (progress >= 1) return "Sudah mendarat";
  const left = `tiba dalam ${formatDuration(trip.sentAt + trip.durMs - now)}`;
  if (state.pausedAt >= 0) return `${trip.events[state.pausedAt].text} · ${left}`;
  return left.charAt(0).toUpperCase() + left.slice(1);
}

function TripRow({ trip, now, active, onSelect }) {
  const animal = ANIMALS[trip.animalId];
  const progress = getProgress(trip, now);
  const state = tripState(trip, progress);

  return (
    <li>
      <button type="button" className="trip-row" aria-current={active ? "true" : undefined} onClick={onSelect}>
        <span className="trip-row__emoji" aria-hidden="true">{animal.emoji}</span>
        <span className="trip-row__main">
          <span className="trip-row__title">
            {trip.petName} <span className="trip-row__route">{cityById(trip.fromId).name} → {cityById(trip.toId).name}</span>
          </span>
          <ProgressBar value={progress} label={`Progres ${trip.petName}`} />
          <span className="trip-row__status">{statusText(trip, now, progress, state)}</span>
        </span>
      </button>
    </li>
  );
}

function ProgressBar({ value, label }) {
  const pct = Math.round(value * 100);
  return (
    <span className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="progress__fill" style={{ width: `${value * 100}%` }} />
    </span>
  );
}

function TripDetail({ trip, now, onDelete }) {
  const animal = ANIMALS[trip.animalId];
  const from = cityById(trip.fromId);
  const to = cityById(trip.toId);
  const progress = getProgress(trip, now);
  const state = tripState(trip, progress);
  const position = interpolate(from, to, state.dist);
  const landed = progress >= 1;
  const fast = trip.speedup > 1;
  const arriveAt = trip.sentAt + trip.durMs;

  const heading = landed
    ? `${trip.petName} sudah mendarat di ${to.name}`
    : state.pausedAt >= 0
      ? `${trip.petName} sedang mampir`
      : `${trip.petName} sedang ${animal.verb} ke ${to.name}`;

  return (
    <section className="detail" aria-labelledby="detail-title">
      <h2 id="detail-title">{heading}</h2>

      <FlightMap
        from={from}
        to={to}
        position={position}
        emoji={animal.emoji}
        label={`Peta rute ${from.name} ke ${to.name}. ${trip.petName} sudah menempuh ${Math.round(state.dist * 100)}% jarak.`}
      />

      <div className="detail__progress">
        <ProgressBar value={progress} label={`Progres ${trip.petName}`} />
        <span>{Math.floor(progress * 100)}%</span>
      </div>

      <dl className="facts">
        <div><dt>Untuk</dt><dd>{trip.recipient}</dd></div>
        <div><dt>Jarak</dt><dd>{trip.distanceKm.toLocaleString("id-ID")} km</dd></div>
        <div><dt>Berangkat</dt><dd>{formatTime(trip.sentAt, fast)}</dd></div>
        <div><dt>{landed ? "Tiba" : "Perkiraan tiba"}</dt><dd>{formatTime(arriveAt, fast)}</dd></div>
        {fast && <div><dt>Simulasi</dt><dd>{formatSpeedup(trip.speedup)}</dd></div>}
      </dl>

      <ol className="timeline">
        <li className="is-done">Berangkat dari {from.name}</li>
        {trip.events.map((e, i) => {
          const status = landed || i < state.passed ? "is-done" : state.pausedAt === i ? "is-now" : "";
          return (
            <li key={i} className={status}>
              {e.text} <span className="timeline__meta">({formatDuration(e.hours * 3600000)})</span>
            </li>
          );
        })}
        <li className={landed ? "is-done" : ""}>Mendarat di {to.name}</li>
      </ol>

      <div className={`letter ${landed ? "" : "letter--sealed"}`}>
        {landed ? (
          <p className="letter__body">{trip.body}</p>
        ) : (
          <p>
            Pesan masih tersegel. Bisa dibuka setelah {trip.petName} mendarat, sekitar {formatDuration(arriveAt - now)} lagi.
          </p>
        )}
      </div>

      <button type="button" className="button-quiet" onClick={onDelete}>Hapus perjalanan</button>
    </section>
  );
}
