import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server only serves its scripts to localhost by default. Opened as
  // 127.0.0.1, the page never hydrates: every button becomes a full reload that
  // lands at the top of /setup. Tunnel hosts stay blocked — browse locally.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
