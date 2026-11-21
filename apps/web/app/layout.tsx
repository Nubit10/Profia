import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { AppToaster } from "@/components/app-toaster";
import { ServiceWorker } from "@/components/service-worker";
import { BRAND_COLOR } from "@/lib/brand-colors";
import "./globals.css";

// SPEC-0012: tipografía de la marca (cercana y legible para titulares y texto).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Titulares de la página pública y del acceso (font-display); el área de trabajo no la usa.
// Fraunces va dentro del proyecto (app/fonts/fraunces, licencia OFL), no desde Google Fonts: con
// Turbopack en `next dev`, según la respuesta de Google fallaba con «next/font/google queries have
// exactly one entry». Es la variable de peso (100–900), en normal e itálica, solo latín (cubre el español).
const fraunces = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    {
      path: "./fonts/fraunces/fraunces-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/fraunces/fraunces-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ProfIA", template: "%s · ProfIA" },
  description:
    "Lucía, la IA de ProfIA, prepara talleres, quices, exámenes y planeaciones alineados con los DBA y el DUA.",
  applicationName: "ProfIA",
  // SPEC-0013 RN-12: instalable también en iPhone (Compartir → Agregar a pantalla de inicio).
  appleWebApp: { capable: true, title: "ProfIA", statusBarStyle: "default" },
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

/** Letra más grande (preferencia del dispositivo), antes de pintar para que no salte. */
const TEXT_SIZE_SCRIPT = `try{if(localStorage.getItem("profia:letra")==="grande")document.documentElement.dataset.letra="grande"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
      // Bloque 8 de usabilidad: "Letra más grande" se aplica antes de pintar (ver TEXT_SIZE_SCRIPT).
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background">
        {children}
        <AppToaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
