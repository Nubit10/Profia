import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfmake se carga desde node_modules en tiempo de ejecución, con sus fuentes embebidas (ADR-0009).
  serverExternalPackages: ["pdfmake"],
  // ADR-0012: el navegador siempre revisa si hay un service worker nuevo al desplegar.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
