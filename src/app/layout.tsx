import type { Metadata, Viewport } from "next";
import { Arimo } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "./providers";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arimo",
});

export const metadata: Metadata = {
  title: "Portal de Vendedores",
  description: "Portal de vendedores offline-first con sincronización asíncrona a HubSpot",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Portal Vendedores",
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
          {/* Notificaciones tipo toast, tematizadas con los tokens de la
              Paleta B — nunca colores literales de sonner por defecto. */}
          <Toaster
            position="top-right"
            richColors={false}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  'flex items-start gap-3 w-full rounded-2xl border border-border bg-surface p-4 text-sm shadow-2xl',
                title: 'font-semibold text-ink',
                description: 'mt-0.5 text-ink-2',
                actionButton:
                  'rounded-lg bg-cta-bg px-3 py-1.5 text-xs font-semibold text-cta-ink hover:bg-accent',
                cancelButton:
                  'rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-border-2',
                closeButton:
                  'border border-border bg-surface text-ink-3 hover:text-ink',
                success: 'border-ok-bd bg-ok-bg text-ok [&_[data-title]]:text-ok',
                error: 'border-bad-bd bg-bad-bg text-bad [&_[data-title]]:text-bad',
                warning:
                  'border-warn-bd bg-warn-bg text-warn [&_[data-title]]:text-warn',
                info: 'border-chip-bd bg-chip text-chip-ink [&_[data-title]]:text-chip-ink',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
