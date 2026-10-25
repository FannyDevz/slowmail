import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, MIN_DISTANCE_KM, formatDuration, getProgress, haversineKm, makeTrip, tripFromRow, tripState } from "../lib/pigeon.js";

const JAKARTA = { lat: -6.21, lng: 106.85, label: "Jakarta" };
const SURABAYA = { lat: -7.26, lng: 112.75, label: "Surabaya" };

describe("makeTrip", () => {
  test("hasilnya sama untuk waktu kirim yang sama (kejadian acak ditentukan sekali)", () => {
    const args = { from: JAKARTA, to: SURABAYA, animalId: "merpati", speedup: 1, sentAt: 1761370000123 };
    assert.deepEqual(makeTrip(args), makeTrip(args));
  });

  test("durasi = jarak / kecepatan + waktu mampir, dibagi speedup", () => {
    const trip = makeTrip({ from: JAKARTA, to: SURABAYA, animalId: "elang", speedup: 3600, sentAt: 42 });
    const pauses = trip.events.reduce((s, e) => s + e.hours, 0);
    const expectedMs = ((trip.distanceKm / ANIMALS.elang.kmh + pauses) * 3600000) / 3600;
    assert.ok(Math.abs(trip.durMs - expectedMs) < 50);
  });

  test("jarak minimal 1 km untuk alamat yang sama", () => {
    const trip = makeTrip({ from: JAKARTA, to: JAKARTA, animalId: "kucing", sentAt: 1 });
    assert.equal(trip.distanceKm, MIN_DISTANCE_KM);
  });

  test("kejadian memakai kunci yang ada di daftar hewan", () => {
    for (let seed = 0; seed < 200; seed++) {
      const trip = makeTrip({ from: JAKARTA, to: SURABAYA, animalId: "kura-kura", sentAt: seed * 7919 });
      for (const e of trip.events) assert.ok(ANIMALS["kura-kura"].events.some((x) => x.key === e.key));
    }
  });
});

describe("posisi", () => {
  test("tidak pernah mundur dan berakhir di tujuan", () => {
    for (let seed = 0; seed < 50; seed++) {
      const trip = makeTrip({ from: JAKARTA, to: SURABAYA, animalId: "kucing", sentAt: seed * 104729 });
      let prev = -1;
      for (let i = 0; i <= 500; i++) {
        const { dist } = tripState(trip, i / 500);
        assert.ok(dist >= prev - 1e-9);
        prev = dist;
      }
      assert.equal(tripState(trip, 1).dist, 1);
    }
  });

  test("progres dibatasi 0..1", () => {
    const trip = { sentAt: 1000, durMs: 1000 };
    assert.equal(getProgress(trip, 0), 0);
    assert.equal(getProgress(trip, 1500), 0.5);
    assert.equal(getProgress(trip, 99999), 1);
  });
});

test("haversine Jakarta–Surabaya sekitar 660 km", () => {
  const km = haversineKm(JAKARTA, SURABAYA);
  assert.ok(km > 640 && km < 680, String(km));
});

test("tripFromRow mengubah baris database menjadi perjalanan", () => {
  const trip = tripFromRow({
    id: "x", sender_id: "s", recipient_id: "r", sender: { username: "a" }, recipient: { username: "b" },
    from_label: "A", from_lat: "-6.21", from_lng: "106.85", to_label: "B", to_lat: "-7.26", to_lng: "112.75",
    animal: "merpati", reply_to: null, read_at: null, sent_at: "2026-10-25T00:00:00Z", arrive_at: "2026-10-25T10:00:00Z",
    distance_km: "600", speedup: 1, events: [],
  });
  assert.equal(trip.durMs, 10 * 3600000);
  assert.equal(trip.from.lat, -6.21);
  assert.equal(trip.travelH, 10);
});

describe("formatDuration", () => {
  test("bahasa Indonesia", () => {
    assert.equal(formatDuration(26 * 3600000, "id"), "1 hari 2 jam");
    assert.equal(formatDuration(65000, "id"), "1 menit 5 detik");
  });
  test("bahasa Inggris memakai bentuk jamak", () => {
    assert.equal(formatDuration(26 * 3600000, "en"), "1 day 2 hours");
    assert.equal(formatDuration(2 * 86400000, "en"), "2 days");
  });
});
