import type { MetadataRoute } from "next";

// Lets Chrome / Samsung Internet install the app on the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AESTHETIQ",
    short_name: "AESTHETIQ",
    description: "Build Your Ideal Physique.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
