import type { NextConfig } from "next";

// Static imports in lib/fixtures.ts inline this JSON into the server bundle.
// The include still copies every fixture onto each Node function so a cold
// start has the files on disk as well. The key is matched with picomatch
// against the normalized App Router path, and `/**` covers `/api/**` and
// `/runs/**`.
const fixtureGlobs = ["./fixtures/**/*.json"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/**": fixtureGlobs,
  },
};

export default nextConfig;
