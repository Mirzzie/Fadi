import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careeros/database", "@careeros/portfolio"],
};

export default nextConfig;
