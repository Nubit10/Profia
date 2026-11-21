// Prueba de usabilidad (2026-11-20): una profesora nueva hace su trabajo de la semana en Profe, sin
// ayuda: cuenta, primer taller, descarga, quiz y plan del mismo tema, corregir una pregunta, examen y
// encontrar lo que hizo. Mide clics, campos escritos, palabras técnicas, controles pequeños y
// desbordes, y guarda una captura y el texto de cada pantalla. Informe: docs/usabilidad/.
// Uso (con la web y el AI Engine de prueba corriendo, p. ej. como en playwright.config.ts):
//   LANG=C.UTF-8 npm run ux:recorrido -w @profe/web -- <baseURL> <carpeta> <movil|escritorio>
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const [baseURL, out, mode] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const mobile = mode === "movil";

const JARGON =
  /\b(blueprint|tenant|prompt|token|schema|RAG|LLM|JSON|endpoint|backend|frontend|deploy|null|undefined|error \d{3}|ID|UUID|slug|query|cache|webhook|API)\b/;

const browser = await chromium.launch();
const context = await browser.newContext(
  mobile
    ? { ...devices["iPhone 13"], viewport: { width: 360, height: 780 }, locale: "es-CO" }
    : { viewport: { width: 1366, height: 860 }, locale: "es-CO" },
);
const page = await context.newPage();
page.setDefaultTimeout(20_000);

const log = [];
let clicks = 0;
let typed = 0;
let shotN = 0;
let task = "";
const counters = {};

const begin = (name) => {
  task = name;
  counters[name] = { clicks: 0, typed: 0, started: Date.now() };
};
const tap = async (locator, label) => {
  clicks += 1;
  counters[task].clicks += 1;
  await locator.click();
  log.push(`  clic: ${label}`);
};
const type = async (locator, value, label) => {
  typed += 1;
  counters[task].typed += 1;
  await locator.fill(value);
  log.push(`  escribe: ${label} = "${value}"`);
};

async function audit(name) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  shotN += 1;
  const file = `${String(shotN).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
  const info = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const small = [
      ...document.querySelectorAll(
        "main a, main button, main input, main [role=radio], main [role=switch], main [role=checkbox], header a, header button, nav a, nav button",
      ),
    ]
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (
            el.getAttribute("aria-label") ||
            el.textContent ||
            el.getAttribute("name") ||
            el.tagName
          )
            .trim()
            .slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
          tag: el.tagName,
        };
      })
      .filter((x) => (x.tag !== "INPUT" ? x.h < 40 || x.w < 40 : x.h < 40));
    const primaries = [...document.querySelectorAll("main .bg-brand-gradient")].filter(
      visible,
    ).length;
    const text = document.querySelector("main")?.innerText ?? document.body.innerText;
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      small,
      primaries,
      words,
      text,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    };
  });
  const jargon = info.text.match(new RegExp(JARGON.source, "g")) ?? [];
  log.push(
    `[${name}] ${file} · h1="${info.h1}" · palabras=${info.words} · alto=${info.height}px · primarios=${info.primaries}` +
      (info.overflow > 0 ? ` · DESBORDE ${info.overflow}px` : "") +
      (jargon.length ? ` · JERGA: ${[...new Set(jargon)].join(", ")}` : "") +
      (mobile && info.small.length
        ? ` · PEQUEÑOS(${info.small.length}): ${info.small
            .slice(0, 6)
            .map((s) => `"${s.text}" ${s.w}×${s.h}`)
            .join("; ")}`
        : ""),
  );
  writeFileSync(`${out}/${file.replace(".png", ".txt")}`, info.text);
}

// El botón "Crear": flotante en el celular, en el menú lateral cuando no está a la vista.
async function openCreate() {
  const fab = page.getByRole("button", { name: /^Crear$/ });
  for (let i = 0; i < (await fab.count()); i++) {
    if (await fab.nth(i).isVisible()) return tap(fab.nth(i), "Crear");
  }
  await tap(page.getByRole("button", { name: "Abrir menú" }), "Abrir menú");
  await tap(page.getByRole("button", { name: /^Crear$/ }).first(), "Crear (menú)");
}

const end = () => {
  const c = counters[task];
  log.push(
    `== ${task}: ${c.clicks} clics, ${c.typed} campos escritos, ${Math.round((Date.now() - c.started) / 1000)} s`,
  );
};

async function waitGenerated(what) {
  const start = Date.now();
  await page
    .getByText(/Estamos creando/)
    .first()
    .waitFor({ state: "detached", timeout: 120_000 })
    .catch(() => undefined);
  log.push(`  espera de la IA (${what}): ${Math.round((Date.now() - start) / 1000)} s`);
}

try {
  // 1. Llega a Profe y crea su cuenta.
  begin("1. Crear cuenta y empezar");
  await page.goto(`${baseURL}/`);
  await audit("landing");
  const cta = page.getByRole("link", { name: /Crear cuenta|Empieza|Comenzar|Registr/i }).first();
  await tap(cta, await cta.innerText());
  await audit("registro");
  await type(page.getByLabel("Nombre"), "Marta Ruiz", "Nombre");
  await type(page.getByLabel("Correo"), `marta-${Date.now()}@colegio.test`, "Correo");
  await type(page.getByLabel("Contraseña", { exact: true }), "contraseña-segura-123", "Contraseña");
  await type(page.getByLabel("Confirmar contraseña"), "contraseña-segura-123", "Confirmar");
  await tap(page.getByRole("button", { name: "Crear cuenta" }), "Crear cuenta");
  await page.waitForURL(/onboarding/);
  await audit("como-vas-a-usar-profe");
  await tap(page.getByRole("button", { name: "Empezar por mi cuenta" }), "Empezar por mi cuenta");
  await page.waitForURL(/dashboard/);
  await audit("inicio-nuevo");
  end();

  // 2. Su primer taller, siguiendo "Primeros pasos".
  begin("2. Primer taller (Primeros pasos)");
  await tap(
    page.getByRole("button", { name: "Crear mi primer curso" }).first(),
    "Crear mi primer curso",
  );
  await audit("crear-curso");
  const pick = async (label, option) => {
    await tap(page.getByLabel(label, { exact: true }), label);
    await tap(page.getByRole("option", { name: option, exact: true }), option);
  };
  await pick("Asignatura", "Matemáticas");
  await pick("Grado", "6°");
  await type(page.getByLabel("Grupo"), "601", "Grupo");
  await tap(page.getByRole("button", { name: "Crear curso" }), "Crear curso");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await audit("inicio-con-curso");
  // Bloque 6 (SPEC-0032): con DBA, Profe propone los temas del primer periodo y ella los acepta.
  const next = page
    .getByRole("link", { name: /Ver los temas propuestos|Escribir mi primer tema|primer tema/ })
    .first();
  const proposed = /propuestos/.test(await next.innerText());
  await tap(next, await next.innerText());
  if (proposed) {
    const add = page.getByRole("button", { name: /Agregar a la planeación/ });
    await add.waitFor({ timeout: 60_000 });
    await audit("temas-propuestos");
    await tap(add, "Agregar a la planeación");
    await page.waitForURL(/dashboard/, { waitUntil: "commit" });
    await tap(page.getByRole("link", { name: "Crear mi primer taller" }), "Crear mi primer taller");
  } else {
    await audit("asistente-tema");
    await type(page.getByLabel(/tema vas a trabajar/), "Fracciones", "Tema");
    await tap(page.getByRole("button", { name: "Usar este tema" }), "Usar este tema");
  }
  await page.getByRole("button", { name: "Generar taller" }).waitFor();
  await audit("ajustes-taller");
  await tap(page.getByRole("button", { name: "Generar taller" }), "Generar taller");
  await audit("taller-generando");
  await waitGenerated("taller");
  await audit("taller-listo");
  end();

  // 3. Descargarlo para imprimir.
  begin("3. Descargar el taller");
  await tap(page.getByRole("button", { name: "Descargar", exact: true }), "Descargar");
  await audit("dialogo-descargar");
  const dl = page.waitForEvent("download").catch(() => null);
  await tap(
    page.getByRole("button", { name: "Marcar como listo y descargar" }),
    "Marcar como listo y descargar",
  );
  log.push(`  descarga: ${(await dl) ? "sí" : "no se detectó"}`);
  await page.waitForTimeout(500);
  end();

  // 4. Un quiz del mismo tema, desde el Inicio (lo más directo que encuentre).
  begin("4. Quiz del mismo tema");
  await audit("taller-que-mas");
  await tap(
    page
      .getByRole("region", { name: /Qué más necesitas/ })
      .getByRole("button", { name: "Crear quiz" }),
    "Crear quiz (mismo tema)",
  );
  await waitGenerated("quiz");
  await audit("quiz-listo");
  end();

  // 5. Corregir una pregunta a mano.
  begin("5. Editar una pregunta");
  // SPEC-0029: el recurso abre en la hoja; "Editar" junto a la pregunta la abre en el editor.
  await tap(page.getByRole("button", { name: "Editar pregunta 1" }), "Editar pregunta 1");
  const q = page.getByRole("list", { name: "Preguntas" }).locator(":scope > li").first();
  await audit("editando-pregunta");
  const stem = q.getByRole("textbox").first();
  await type(stem, "¿Cuál fracción es equivalente a 1/2?", "Enunciado");
  await tap(q.getByRole("button", { name: "Listo" }), "Listo");
  await page.waitForTimeout(800);
  await audit("pregunta-guardada");
  end();

  // 6. Plan de aula para el coordinador.
  begin("6. Plan de aula");
  await tap(
    page
      .getByRole("region", { name: /Qué más necesitas/ })
      .getByRole("button", { name: "Crear plan de aula" }),
    "Crear plan de aula (mismo tema)",
  );
  await waitGenerated("plan");
  await audit("plan-listo");
  end();

  // 7. Examen del periodo.
  begin("7. Examen del periodo");
  // Bloque 7 (SPEC-0033): en el celular, "Crear" está en la barra de abajo.
  await openCreate();
  await tap(page.getByRole("menuitem", { name: /^Examen/ }), "Examen");
  await audit("examen-temas");
  // Con los temas propuestos el nombre cambia: marca el de "Fracciones" o, si no, el primero.
  const named = page.getByRole("checkbox", { name: /Fracciones/ });
  const topicBox = (await named.count()) ? named.first() : page.getByRole("checkbox").first();
  if (!(await topicBox.isChecked())) await tap(topicBox, "Marca el primer tema");
  const cont = page.getByRole("button", { name: /Continuar|Siguiente/ }).first();
  if (await cont.count()) await tap(cont, await cont.innerText());
  await audit("examen-ajustes");
  const next2 = page.getByRole("button", { name: /Continuar|Revisar|Siguiente/ }).first();
  if (await next2.count()) await tap(next2, await next2.innerText());
  await audit("examen-confirmar");
  const gen = page.getByRole("button", { name: /Generar examen/ }).first();
  await tap(gen, "Generar examen");
  await waitGenerated("examen");
  await audit("examen-listo");
  end();

  // 8. Encontrar lo que hizo.
  begin("8. Encontrar mis recursos");
  // Bloque 7 (SPEC-0033): en el celular, la barra de abajo; en el recurso (que tiene su propia
  // barra) o si no se ve, el menú. En escritorio, el menú lateral.
  const tabs = page.getByRole("navigation", { name: "Navegación principal" });
  const sidebar = page.locator("aside").getByRole("link", { name: "Mis recursos" });
  if (await tabs.isVisible()) {
    await tap(tabs.getByRole("link", { name: "Mis recursos" }), "Mis recursos (barra)");
  } else if (await sidebar.isVisible()) {
    await tap(sidebar, "Mis recursos");
  } else {
    await tap(page.getByRole("button", { name: "Abrir menú" }), "Menú");
    await tap(
      page.getByRole("dialog", { name: "Menú" }).getByRole("link", { name: "Mis recursos" }),
      "Mis recursos",
    );
  }
  await audit("mis-recursos");
  end();
} catch (error) {
  log.push(`!! SE ATASCÓ en "${task}": ${String(error).split("\n")[0]}`);
  await audit("atascada").catch(() => undefined);
}

log.push(`TOTAL: ${clicks} clics, ${typed} campos escritos`);
writeFileSync(`${out}/informe.txt`, log.join("\n"));
console.log(log.join("\n"));
await browser.close();
