import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import { AppearanceRuntime } from "../../../web/src/components/providers/appearance-runtime";
import { APPEARANCE_BOOTSTRAP } from "../../../web/src/lib/appearance/preferences";

import "./globals.css";
import data from "@export/data/portfolio.json";

// The same self-hosted faces and device-local appearance contract as the app.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: [data.site.title, data.site.headline].filter(Boolean).join(" | "),
  description: data.site.profile.bio,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-palette="ember"
      data-appearance="system"
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body style={{ margin: 0 }}>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }} />
        <AppearanceRuntime />
        {children}
      </body>
    </html>
  );
}
