import type { NextConfig } from "next";

// Static export of the portfolio (ADR 0009). Produces out/ — a full static site that
// runs on any static host. basePath is set per target: GitHub project sites need
// "/<repo>"; apex domains / Vercel / Netlify need none.
const basePath = process.env.PORTFOLIO_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true }, // static host: no image optimizer
  // Compile the shared template + components imported from apps/web as source.
  transpilePackages: ["@careeros/database"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
