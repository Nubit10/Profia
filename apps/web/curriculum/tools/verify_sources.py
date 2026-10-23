"""Verifica los archivos del catálogo contra el texto extraído de los PDF oficiales (ADR-0005).

Uso (desde apps/web): python curriculum/tools/verify_sources.py

Comprobaciones:
1. Fidelidad: cada enunciado y evidencia aparece literalmente en el texto del PDF (solo se
   normalizan espacios y guiones de fin de línea). Las excepciones son las correcciones
   documentadas en tools/fixes/*.json (replaceText).
2. Completitud: el número de viñetas de evidencias en las páginas de DBA del PDF coincide con el
   número de evidencias del catálogo (descontando las viñetas del encabezado de página).
3. Numeración: los DBA de cada grado van de 1 a N sin saltos.
Sale con código 1 si alguna comprobación falla.
"""

import json
import os
import re
import sys

BASE = os.path.join(os.path.dirname(__file__), "..")
BULLETS = {
    "dba-matematicas-v2": r"(?:^|\s)m\s*(?=[A-ZÁÉÍÓÚ¿])",
    "dba-lenguaje-v2": r"(?:^|\s)m\s*(?=[A-ZÁÉÍÓÚ¿])",
    "dba-transicion-v1": r"•\s*(?=[A-ZÁÉÍÓÚ¿])",
}
RAW = {
    "dba-matematicas-v2": "sources/dba_matematicas-min.raw.txt",
    "dba-lenguaje-v2": "sources/dba_lenguaje-min.raw.txt",
    "dba-transicion-v1": "sources/dba_transicion-min_0.raw.txt",
}


def norm(text: str) -> str:
    text = re.sub(r"(\w)- (\w)", r"\1\2", text.replace("­", ""))
    return re.sub(r"\s+", " ", text).strip()


def main():
    registry = json.load(open(os.path.join(BASE, "tools/sources.json"), encoding="utf8"))
    failed = False
    for slug, entry in registry.items():
        doc = json.load(open(os.path.join(BASE, "men", f"{slug}.json"), encoding="utf8"))
        raw_text = open(os.path.join(BASE, RAW[slug]), encoding="utf8").read()
        raw = norm(raw_text.replace("\f", " "))
        raw_no_bullets = re.sub(r"\s*\b[m•]\s*(?=[A-ZÁÉÍÓÚ¿])", " ", raw)
        fixes = json.load(open(os.path.join(BASE, entry["fixes"]), encoding="utf8")) if entry.get("fixes") else {}
        fixed = {(r["code"], r["replace"]) for r in fixes.get("replaceText", [])}

        not_found = []
        for item in doc["items"]:
            for text in [item["statement"], *item["evidences"]]:
                if text in raw or text in raw_no_bullets:
                    continue
                if any(code == item["code"] and rep in text for code, rep in fixed):
                    continue
                not_found.append(f"{item['code']}: {text[:90]}")

        # Páginas de DBA: las de un grado o las que tienen evidencias (algunas continúan sin encabezado).
        pages = [
            p for p in raw_text.split("\f") if re.search(r"Grado\s+\d|Evidencias de aprendizaje", p)
        ]
        # El "• V.n" del encabezado de página no es una viñeta (solo cuenta si las viñetas son "•").
        header_bullets = (
            sum(len(re.findall(r"•\s*V\.\d", p)) for p in pages) if "•" in BULLETS[slug] else 0
        )
        pdf_bullets = sum(len(re.findall(BULLETS[slug], p, re.M)) for p in pages) - header_bullets
        catalog_bullets = sum(len(i["evidences"]) for i in doc["items"])

        numbering = []
        by_grade: dict[str, list[int]] = {}
        for item in doc["items"]:
            by_grade.setdefault(item["grade"], []).append(item["number"])
        for grade, numbers in by_grade.items():
            if numbers != list(range(1, len(numbers) + 1)):
                numbering.append(grade)

        ok = not not_found and pdf_bullets == catalog_bullets and not numbering
        failed |= not ok
        print(f"{'OK ' if ok else 'ERR'} {slug}: {len(doc['items'])} ítems · viñetas PDF {pdf_bullets} / catálogo {catalog_bullets}")
        for line in not_found:
            print("    no está literal en el PDF:", line)
        if numbering:
            print("    numeración con saltos en:", numbering)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
