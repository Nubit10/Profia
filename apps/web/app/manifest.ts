import type { MetadataRoute } from "next";
import { BACKGROUND_COLOR, BRAND_COLOR } from "@/lib/brand-colors";

/**
 * SPEC-0013 RN-12 y ADR-0012: Profe se instala como app. Abre en el Inicio del área de trabajo
 * (como CliqCut abre el panel de quien trabaja); sin sesión, `proxy.ts` lleva al login y vuelve.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profe",
    short_name: "Profe",
    description: "Talleres, quices y exámenes con IA, alineados a los DBA. Tú revisas y decides.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: BACKGROUND_COLOR,
    theme_color: BRAND_COLOR,
    lang: "es-CO",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
