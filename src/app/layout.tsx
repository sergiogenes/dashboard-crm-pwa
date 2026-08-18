import type { Metadata, Viewport } from "next";
import { Arimo } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arimo",
});

export const metadata: Metadata = {
  title: "PWA CRM Dashboard",
  description: "Dashboard CRM offline-first con sincronización asíncrona a HubSpot",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM Dashboard",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: "#11383F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full bg-bg text-ink selection:bg-primary selection:text-white ${arimo.variable}`}>
      <body className="font-sans h-full min-h-screen antialiased">
        <Providers>
          <ServiceWorkerRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
