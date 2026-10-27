import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  title: "Aesthetic Gym Scanner",
  description: "Snap your gym, pick Push / Pull / Legs, get your Natty Blueprint session.",
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
      <body className={`${geistSans.variable} ${accent.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
