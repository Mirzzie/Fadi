import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";

// Set the theme before paint so there's no flash. An inline script via
// dangerouslySetInnerHTML is the App Router pattern that actually executes
// pre-hydration (next/script children are flagged + not run by React 19).
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

export const metadata: Metadata = {
  title: {
    default: "FadiOS AI",
    template: "%s | FadiOS AI",
  },
  description: "AI-first career operating system MVP foundation.",
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
