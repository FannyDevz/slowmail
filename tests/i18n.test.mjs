import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { dictionary, t } from "../lib/i18n.js";
import { ANIMALS } from "../lib/pigeon.js";

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

test("setiap hewan dan kejadian punya teks", () => {
  for (const animal of Object.values(ANIMALS)) {
    assert.ok(dictionary.animals[animal.id]?.name, `animals.${animal.id}`);
    for (const e of animal.events) assert.ok(dictionary.events[e.key], `events.${e.key}`);
  }
});

test("parameter diganti", () => {
  assert.equal(t("errors.usernameTaken", { username: "ani" }), "@ani is already taken.");
});

// Semua t("...") statis di kode harus ada di kamus.
test("kunci yang dipakai di kode ada di kamus", () => {
  const root = join(import.meta.dirname, "..");
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  ["app", "components", "lib"].forEach((d) => walk(join(root, d)));
  const all = new Set(keys(dictionary));
  const missing = [];
  for (const file of files) {
    for (const [, key] of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([a-zA-Z]+\.[a-zA-Z.]+)"/g)) {
      if (!all.has(key)) missing.push(`${key} (${file.slice(root.length + 1)})`);
    }
  }
  assert.deepEqual(missing, []);
});
