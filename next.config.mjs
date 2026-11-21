/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
