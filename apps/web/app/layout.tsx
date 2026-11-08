import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sileo";
import { ServiceWorker } from "@/components/service-worker";
import { BRAND_COLOR } from "@/lib/brand-colors";
import "./globals.css";

// SPEC-0012: tipografía de la marca (cercana y legible para titulares y texto).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Titulares de la página pública y del acceso (font-display); el área de trabajo no la usa.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Profe", template: "%s · Profe" },
  description: "Plataforma de gestión y producción pedagógica asistida por IA.",
  applicationName: "Profe",
  // SPEC-0013 RN-12: instalable también en iPhone (Compartir → Agregar a pantalla de inicio).
  appleWebApp: { capable: true, title: "Profe", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // El contenido llega a los bordes del teléfono; las áreas seguras las respetan los estilos.
  viewportFit: "cover",
  themeColor: BRAND_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        {children}
        <Toaster position="bottom-right" />
        <ServiceWorker />
      </body>
    </html>
  );
}
