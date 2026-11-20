import "server-only";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";
import vfs from "pdfmake/build/vfs_fonts";

// ADR-0018: el Word lleva la figura como PNG. Se rasteriza el SVG con la Roboto que ya trae pdfmake
// (sin fuentes del sistema), así el texto sale igual en el equipo de desarrollo y en el servidor.

const FONTS = ["Roboto-Regular.ttf", "Roboto-Medium.ttf"].map((name) =>
  Buffer.from((vfs as Record<string, string>)[name]!, "base64"),
);

/** PNG al doble de resolución para que se vea nítido al imprimir. */
export function figurePng(svg: string): Buffer {
  // `fontBuffers` existe desde resvg-js 2.5 pero sus tipos 2.6.2 no lo declaran.
  const font = { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: "Roboto" };
  const resvg = new Resvg(svg, {
    font: font as ResvgRenderOptions["font"],
    fitTo: { mode: "zoom", value: 2 },
  });
  return Buffer.from(resvg.render().asPng());
}
