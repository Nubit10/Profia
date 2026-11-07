// SPEC-0013 RN-12: íconos de la app instalable a partir del logo de Profe (el birrete sobre el
// degradado de marca, como `ProfeMark`). Se dibujan en Chromium para que el resultado sea igual en
// cualquier equipo: `node scripts/generate-app-icons.mjs` (desde apps/web).
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { HiOutlineAcademicCap } from "react-icons/hi2";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));
// Colores de --brand-from, --brand-via y --brand-to (app/globals.css).
const GRADIENT = ["#cf3d0c", "#be185d", "#7c3aed"];
const cap = renderToStaticMarkup(createElement(HiOutlineAcademicCap, { color: "#ffffff" }));

/**
 * `maskable`: el sistema recorta el ícono (círculo, gota…); el birrete queda dentro del 60 %
 * central (zona segura del 80 %) y el degradado llena todo el cuadro.
 */
function svg(size, { maskable, rounded }) {
  const capSize = size * (maskable ? 0.5 : 0.58);
  const offset = (size - capSize) / 2;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0.4" x2="1" y2="0.6">
      <stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="0.52" stop-color="${GRADIENT[1]}"/>
      <stop offset="1" stop-color="${GRADIENT[2]}"/></linearGradient></defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
    <svg x="${offset}" y="${offset}" width="${capSize}" height="${capSize}">${cap.replace(/height="1em" width="1em"/, 'width="100%" height="100%"')}</svg>
  </svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, rounded: true },
  { file: "icon-512.png", size: 512, rounded: true },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  // iPhone redondea las esquinas por su cuenta: el ícono de Apple va cuadrado.
  { file: "apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(icon.size, icon)}</body></html>`,
  );
  await page
    .locator("svg")
    .first()
    .screenshot({ path: OUT + icon.file, omitBackground: true });
  console.log("Ícono", icon.file);
}
await browser.close();
