/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    // the service worker must never be served stale, or fixes to it never reach phones
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
