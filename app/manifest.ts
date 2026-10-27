import type { MetadataRoute } from "next";

// Lets Chrome / Samsung Internet install the app on the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aesthetic Gym Scanner",
    short_name: "Gym Scanner",
    description: "Snap your gym, pick a session, get your Natty Blueprint workout.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
