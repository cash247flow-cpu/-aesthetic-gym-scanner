import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { AiConsentHost } from "@/components/AiConsent";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

// Instrument Serif Italic (SIL Open Font License, see fonts/InstrumentSerif-OFL.txt) for accent words.
const accent = localFont({
  src: "./fonts/InstrumentSerif-Italic.ttf",
  variable: "--font-accent",
  style: "italic",
  weight: "400",
});

export const metadata: Metadata = {
  title: "AESTHETIQ — Build Your Ideal Physique",
  description: "Build Your Ideal Physique. Snap your gym, pick a session, get a workout that only uses the equipment you have.",
  applicationName: "AESTHETIQ",
  // Private app: keep every page out of search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  appleWebApp: { capable: true, title: "AESTHETIQ", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" }], apple: "/apple-icon.png?v=2" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the request makes every page render per request, so Next.js can put the CSP nonce
  // from middleware on its scripts (see lib/csp.ts).
  await headers();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${accent.variable} font-sans antialiased`}>
        {children}
        <RegisterSW />
        <AiConsentHost />
      </body>
    </html>
  );
}
