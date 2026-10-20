import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Outfit } from "next/font/google";
import Script from "next/script";

import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";

// Set the theme before paint so there's no flash. next/script with
// strategy="beforeInteractive" is injected into the initial HTML and runs before
// hydration — unlike a raw <script> element, which React 19 flags ("scripts inside
// React components are never executed on the client").
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for large hero headlines (tight, bold grotesque).
const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
});

// Heading face — friendly, rounded, modern. Carries Fadi's "for everyone" voice
// across every heading in the system (see --font-heading in globals.css).
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fadi",
    template: "%s | Fadi",
  },
  description: "The career mentor that tells you the truth — honest job search, no ghost jobs, no hype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
