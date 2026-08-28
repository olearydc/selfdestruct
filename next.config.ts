import type { NextConfig } from "next";

// Cache-Control and Referrer-Policy for the create/reveal pages are set in
// middleware.ts instead of here — Next.js overrides a page-level
// Cache-Control set via headers() for dynamically rendered routes, but not
// one set in middleware.
const nextConfig: NextConfig = {};

export default nextConfig;
