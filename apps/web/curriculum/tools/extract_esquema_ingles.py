"""Extrae los DBA de Inglés 6° a 11° del «Esquema Curricular Sugerido de Inglés» (MEN, 2021) — SPEC-0038.

Uso: python curriculum/tools/extract_esquema_ingles.py <archivo.pdf> <prefijo-code> <salida.json>

Págs. 33-38 (sección 3; la pág. 15 trae un ejemplo de 6° que no se usa): una por grado (6° nivel A1 … 11° nivel B1.3). Arriba de cada página, en la franja
«DERECHOS BÁSICOS INGLÉS», van los DBA en tres columnas de viñetas; debajo, META, FUNCIONES y
OBJETIVOS por módulo (no se extraen). El esquema trae la versión corta de los DBA: sin evidencias.

Cada viñeta es un ítem `DBA` del grado, numerado por columnas (de izquierda a derecha y de arriba
abajo); `component` = «Nivel A1» … (el nivel de inglés del grado), `evidences` = [].

Algunas viñetas usan una fuente que pdftotext no descifra («,iVVivÀ>…»). El extractor las deja
como «[ilegible]»; el texto correcto va en tools/fixes/dba-ingles-esquema-v1.json, transcrito
de la imagen de la página (verifiedVisually).

`band(pdf)` da la franja de cada página; `verify` la usa para recortar el PDF por otro camino.
"""

import json
import re
import subprocess
import sys

from extract_ebc import clean, lines_of, pages

GRADE = re.compile(r"3\.\d\.\s*NIVEL\s+([AB]\d(?:\.\d)?)\s*[–-]\s*GRADO SUGERIDO:\s*(\d{1,2})")
GARBLED = re.compile(r"[\x00-\x1f\x7f-\x9fÀÃÌÕÝ>`]")
ILLEGIBLE = "[ilegible]"


def mark_illegible(text: str) -> str:
    """Cambia cada tramo con la fuente ilegible por «[ilegible]» (la corrección pone el texto)."""
    words = text.split(" ")
    out: list[str] = []
    for word in words:
        if GARBLED.search(word):
            if not out or out[-1] != ILLEGIBLE:
                out.append(ILLEGIBLE)
        else:
            out.append(word)
    return " ".join(out)


def band(words):
    """(nivel, grado, y_inicio, y_fin) de la franja de DBA de una página, o None."""
    lines = lines_of(words)
    text = " ".join(l["text"] for l in sorted(lines, key=lambda l: l["y"]))
    m = GRADE.search(text)
    if not m:
        return None
    title = min(l["y"] for l in lines if "GRADO SUGERIDO" in l["text"])
    meta = min(l["y"] for l in lines if l["text"].strip() == "META")
    return m.group(1), int(m.group(2)), title + 15, meta - 3


def extract(pdf: str):
    results = []
    for index, width, words in pages(pdf):
        b = band(words)
        if b is None:
            continue
        level, grade, top, bottom = b
        body = [l for l in lines_of([w for w in words if top < w["y"] < bottom and w["x"] > 100])]
        bullets = [l for l in body if l["text"].startswith("•")]
        starts: list[float] = []
        for x in sorted({round(l["x"]) for l in bullets}):
            if not starts or x - starts[-1] > 30:
                starts.append(x)
        columns = [[] for _ in starts]
        for l in sorted(body, key=lambda l: l["y"]):
            i = max(i for i, s in enumerate(starts) if l["x"] >= s - 10)
            if l["text"].startswith("•"):
                columns[i].append(l["text"].lstrip("•").strip())
            elif columns[i]:
                columns[i][-1] += " " + l["text"]
        items = [mark_illegible(clean(t)) for c in columns for t in c]
        results.append({"level": level, "grade": grade, "page": index, "items": items})
    return results


def crop_text(pdf: str, page: int, top: float, bottom: float) -> str:
    return subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-f", str(page), "-l", str(page), "-x", "100", "-y", str(int(top)),
         "-W", "520", "-H", str(int(bottom - top)), pdf, "-"],
        capture_output=True, text=True, check=True,
    ).stdout


def main():
    pdf, prefix, out_path = sys.argv[1:4]
    out = []
    for g in extract(pdf):
        for number, text in enumerate(g["items"], start=1):
            code = f"{prefix}-G{g['grade']}-{number:02d}"
            if ILLEGIBLE in text:
                print(f"  fuente ilegible, transcribir de la imagen: {code} (pág. {g['page']}): {text}")
            out.append(
                {
                    "code": code,
                    "type": "DBA",
                    "area": "INGLES",
                    "grade": f"G{g['grade']}",
                    "number": number,
                    "component": f"Nivel {g['level']}",
                    "statement": text,
                    "evidences": [],
                    "page": g["page"],
                }
            )
        print(f"{g['grade']}° nivel {g['level']} (pág. {g['page']}): {len(g['items'])} DBA")
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"total: {len(out)} DBA")


if __name__ == "__main__":
    main()
