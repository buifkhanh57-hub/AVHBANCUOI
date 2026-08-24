import type { NextConfig } from "next";

/**
 * Next.js configuration for AVH Store.
 *
 * DEPLOYMENT TARGETS:
 *   - Local dev (bun run dev)
 *   - Netlify production (via @netlify/nextjs runtime plugin — auto-detected)
 *
 * NOTE: We do NOT use `output: "standalone"` here. That mode is for
 * self-hosted Node.js servers (e.g. a VPS running `node server.js`).
 * Netlify's Next.js runtime plugin reads the standard `.next/` build
 * output and bundles each route + API handler as an individual serverless
 * function. Setting `output: "standalone"` would actually break the
 * Netlify build (it expects standard output, not the standalone trace).
 *
 * Type-checking and ESLint are NOT bypassed at build time — the task
 * spec explicitly forbids `ignoreBuildErrors` / `ignoreDuringBuilds`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    // Allow image optimization from these remote hosts. Cloudinary is
    // configured by the operator via CLOUDINARY_URL env var; VietQR /
    // qrserver are used for bank-transfer QR codes; the localhost entry
    // is for the dev sandbox preview URL.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'img.vietqr.io' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
};

export default nextConfig;
