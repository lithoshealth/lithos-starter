import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server only serves its scripts to localhost by default. Opened as
  // 127.0.0.1, the page never hydrates: every button becomes a full reload that
  // lands at the top of /setup. Tunnel hosts stay blocked — browse locally.
  allowedDevOrigins: ["127.0.0.1"],
  // Pin the project root to this folder. Otherwise Next.js looks upward for a
  // lockfile, and a stray one higher up (a leftover ~/package-lock.json is
  // common) makes it print a warning on every start — the first thing a new
  // partner sees, about a file that isn't theirs.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
