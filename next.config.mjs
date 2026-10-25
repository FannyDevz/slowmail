/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Boleh diarahkan ke folder lain, supaya `next build` tidak bentrok dengan dev server yang sedang jalan.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
