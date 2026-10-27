import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

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
  appleWebApp: { capable: true, title: "AESTHETIQ", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" }], apple: "/apple-icon.png?v=2" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${accent.variable} font-sans antialiased`}>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
