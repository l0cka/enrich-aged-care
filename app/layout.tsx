import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import Script from "next/script";

import { CollectionIndicator } from "@/components/collection-indicator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toast } from "@/components/toast";
import "./globals.css";

const displayFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  description: "Readable, structured, enriched copies of Australia’s aged care legislation.",
  title: "Enrich Aged Care",
};

const themeInitScript = `
  (() => {
    const storageKey = "enrich-aged-care-theme";
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <div className="page-shell">
          <header className="site-header">
            <div className="site-header__inner">
              <Link className="site-brand" href="/">
                <span className="site-brand__eyebrow">Public legislation explorer</span>
                <span className="site-brand__title">Enrich Aged Care</span>
              </Link>

              <div className="site-header__actions">
                <CollectionIndicator />
                <nav className="site-nav" aria-label="Primary">
                  <Link href="/">Corpus</Link>
                  <Link href="/search">Search</Link>
                  <Link href="/graph">Structure</Link>
                </nav>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main>{children}</main>
        </div>
        <Toast />
      </body>
    </html>
  );
}
