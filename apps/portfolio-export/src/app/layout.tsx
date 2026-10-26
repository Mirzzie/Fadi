import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Mona_Sans } from "next/font/google";
import Script from "next/script";

import { AppearanceRuntime } from "../../../web/src/components/providers/appearance-runtime";
import { SurfaceEffects } from "../../../web/src/components/providers/surface-effects";
import { PublicAppearance } from "../../../web/src/components/portfolio/public-appearance";
import { APPEARANCE_BOOTSTRAP } from "../../../web/src/lib/appearance/preferences";

import "./globals.css";
import data from "@export/data/portfolio.json";

// The same self-hosted faces and device-local appearance contract as the app.
const inter = Mona_Sans({ variable: "--font-inter", subsets: ["latin"] });
const editorial = Instrument_Serif({
  variable: "--font-editorial",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});
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
      className={`${inter.variable} ${editorial.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body style={{ margin: 0 }}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }}
        />
        <AppearanceRuntime />
        <SurfaceEffects />
        {children}
        <PublicAppearance />
      </body>
    </html>
  );
}
