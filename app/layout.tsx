import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SPECTRAEYE | Browser Eye Tracker",
  description: "Real-time eye tracking and iris color extraction built with Next.js, MediaPipe, TensorFlow.js, Canvas API, and Framer Motion.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
