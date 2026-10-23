import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sileo";
import "./globals.css";

// SPEC-0012: tipografía de la marca (cercana y legible para titulares y texto).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Profe", template: "%s · Profe" },
  description: "Plataforma de gestión y producción pedagógica asistida por IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
