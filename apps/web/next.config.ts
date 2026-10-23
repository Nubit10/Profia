import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfmake se carga desde node_modules en tiempo de ejecución, con sus fuentes embebidas (ADR-0009).
  serverExternalPackages: ["pdfmake"],
};

export default nextConfig;
