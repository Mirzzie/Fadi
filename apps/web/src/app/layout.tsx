import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Mona_Sans } from "next/font/google";
import Script from "next/script";

import { QueryProvider } from "@/components/providers/query-provider";
import { AppearanceRuntime } from "@/components/providers/appearance-runtime";
import { SurfaceEffects } from "@/components/providers/surface-effects";
import { APPEARANCE_BOOTSTRAP } from "@/lib/appearance/preferences";

import "./globals.css";

// Set the theme before paint so there's no flash. next/script with
// strategy="beforeInteractive" is injected into the initial HTML and runs before
// hydration — unlike a raw <script> element, which React 19 flags ("scripts inside
// React components are never executed on the client").

// Keep the legacy CSS variable name so existing consumers share the same new face.
const inter = Mona_Sans({
  variable: "--font-inter",
  subsets: ["latin"],
});

const editorial = Instrument_Serif({
  variable: "--font-editorial",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fadi",
    template: "%s | Fadi",
  },
  description:
    "Plan career moves, prepare applications, practise the work, and keep a useful record.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
      data-palette="ember"
      data-appearance="system"
      className={`${inter.variable} ${editorial.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }}
        />
        <AppearanceRuntime />
        <SurfaceEffects />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
