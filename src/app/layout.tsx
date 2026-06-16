import type { Metadata } from "next";
import { Space_Grotesk, Manrope, Space_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import ChromeWrapper from "@/components/site/ChromeWrapper";
import MobileCartBar from "@/components/site/MobileCartBar";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const SITE_DESC =
  "Botellas, latas, cajas y cristalería para cervecerías, destilerías, bares y bodegas. Stock real, envíos a todo el país y decorado propio.";

export const metadata: Metadata = {
  title: {
    default: "DC Inc — Packaging y cristalería mayorista",
    template: "%s · DC Inc",
  },
  description: SITE_DESC,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://dcinc.com.ar",
  ),
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "DC Inc",
    title: "DC Inc — Packaging y cristalería mayorista",
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "DC Inc — Packaging y cristalería mayorista",
    description: SITE_DESC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      localization={esES}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#E8B53D",
          colorText: "#1A1A1A",
          colorTextSecondary: "#6E6E6B",
          colorBackground: "#FFFFFF",
          fontFamily: "var(--font-body)",
          borderRadius: "10px",
        },
      }}
    >
      <html
        lang="es"
        className={`${display.variable} ${body.variable} ${mono.variable}`}
      >
        <body>
          <ChromeWrapper header={<Header />} footer={<Footer />}>
            {children}
          </ChromeWrapper>
          <MobileCartBar />
        </body>
      </html>
    </ClerkProvider>
  );
}
