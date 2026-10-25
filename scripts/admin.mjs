// Alat admin dari terminal.
// Pakai: npm run admin -- grant <email>          jadikan super admin
//        npm run admin -- revoke <email>         cabut super admin
//        npm run admin -- list                   daftar super admin
//        npm run admin -- set-password <email>   ganti kata sandi (diketik tersembunyi, harus di terminal interaktif)
import { createClient } from "@supabase/supabase-js";

const USAGE = "Pakai: npm run admin -- grant <email> | revoke <email> | list | set-password <email>";
const MIN_PASSWORD = 8;

const [command, rawEmail] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur (.env.local).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

// Membaca input tanpa menampilkannya di layar (karakter tidak di-echo).
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          return reject(new Error("dibatalkan"));
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

if (command === "list") {
  const admins = (await allUsers()).filter((u) => u.app_metadata?.role === "superadmin");
  console.log(admins.length ? admins.map((u) => `- ${u.email}`).join("\n") : "Belum ada super admin.");
  process.exit(0);
}

if (!["grant", "revoke", "set-password"].includes(command) || !rawEmail) {
  console.error(USAGE);
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const user = (await allUsers()).find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`Tidak ada akun dengan email ${email}.`);
  process.exit(1);
}

if (command === "set-password") {
  // Tanpa terminal interaktif (mis. prompt "!" di Claude Code) input tidak bisa disembunyikan, jadi ditolak.
  if (!process.stdin.isTTY) {
    console.error("Perintah ini harus dijalankan di aplikasi Terminal biasa, supaya kata sandi bisa diketik tersembunyi.");
    process.exit(1);
  }
  const password = await askHidden(`Kata sandi baru untuk ${email}: `);
  if (password.length < MIN_PASSWORD) {
    console.error(`Kata sandi minimal ${MIN_PASSWORD} karakter.`);
    process.exit(1);
  }
  if ((await askHidden("Ketik sekali lagi: ")) !== password) {
    console.error("Kedua kata sandi tidak sama.");
    process.exit(1);
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error("Gagal:", error.message);
    process.exit(1);
  }
  console.log(`Kata sandi ${email} sudah diganti. Silakan masuk dengan kata sandi baru.`);
  process.exit(0);
}

const { role, ...rest } = user.app_metadata ?? {};
const app_metadata = command === "grant" ? { ...rest, role: "superadmin" } : rest;
const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata });
if (error) {
  console.error("Gagal:", error.message);
  process.exit(1);
}
console.log(command === "grant" ? `${email} sekarang super admin. Keluar lalu masuk lagi supaya sesinya diperbarui.` : `Peran super admin ${email} dicabut.`);
