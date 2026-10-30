// Security headers for every response. The Content-Security-Policy itself is set per request in
// middleware.ts (it needs a fresh nonce); these are the static ones.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera photos come from the phone's own camera app via file inputs, so the page itself needs
  // no camera, microphone or location access. Fullscreen/autoplay stay allowed for exercise videos.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// HTTPS-only hosts get HSTS (Vercel serves every deployment over HTTPS).
const hsts = { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: process.env.NODE_ENV === "production" ? [...securityHeaders, hsts] : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
