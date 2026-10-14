import type { NextConfig } from "next";

// Lint runs via `npm run lint` (eslint flat config). Skip the legacy
// `next lint` integration during builds (broken with ESLint 9).
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
