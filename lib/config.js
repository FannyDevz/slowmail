// Kecepatan simulasi hanya untuk pengujian. Di produksi harus diaktifkan eksplisit.
export function isSimulationAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SIMULATION === "true";
}
