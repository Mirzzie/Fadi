import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@careeros/database",
    // Vendored Reactive Resume render/export stack (ADR 0010) — consumed as source.
    "@reactive-resume/schema",
    "@reactive-resume/resume",
    "@reactive-resume/utils",
    "@reactive-resume/fonts",
    "@reactive-resume/pdf",
  ],
};

export default nextConfig;
