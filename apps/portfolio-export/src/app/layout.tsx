import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "./globals.css";

// Same faces as the live app (apps/web/src/app/layout.tsx) so the export matches:
// Geist = sans (body + hero), Geist Mono = the mono eyebrows/labels, Inter = display.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = { title: "Portfolio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
