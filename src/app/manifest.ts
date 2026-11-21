import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEELARYAN Café",
    short_name: "NEELARYAN",
    description: "Order at your table or for takeaway, track it live and earn rewards.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF6EC",
    theme_color: "#FAF6EC",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
