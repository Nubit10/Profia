"""Extrae los Estándares Básicos de Competencias Ciudadanas (MEN, 2006) — SPEC-0038.

Uso: python curriculum/tools/extract_ciudadanas.py <archivo.pdf> <prefijo-code> <salida.json>

Fuente: «Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas»,
págs. 170-179. Cada grupo de grados ocupa dos páginas enfrentadas con tres columnas (Convivencia y
paz; Participación y responsabilidad democrática; Pluralidad, identidad y valoración de las
diferencias). Cada columna trae su estándar general en un recuadro y, debajo de «Así, paso a
paso... lo voy logrando», los estándares específicos en viñetas.

Cada viñeta es un ítem `STANDARD`:
- `component`: el grupo de estándares (la columna);
- `statement`: el estándar específico, literal, con su paréntesis («(Competencias cognitivas).»);
- `evidences`: el estándar general de la columna (como en Ciencias Sociales y Lenguaje).
"""

import json
import re
import sys

from extract_ebc import GROUPS, clean, lines_of, pages, within

TITLE = "Estándares Básicos de Competencias Ciudadanas"
HEADER_HEIGHT = (10.0, 11.5)
BODY_HEIGHT = (8.5, 10.0)
COMPONENTS = {
    "CONVIVENCIA Y PAZ": "Convivencia y paz",
    "PARTICIPACIÓN Y RESPONSABILIDAD DEMOCRÁTICA": "Participación y responsabilidad democrática",
    "PLURALIDAD, IDENTIDAD Y VALORACIÓN DE LAS DIFERENCIAS": "Pluralidad, identidad y valoración de las diferencias",
}


def extract(pdf: str):
    all_pages = list(pages(pdf))
    by_index = {index: (width, words) for index, width, words in all_pages}
    results = []
    for index, width, words in all_pages:
        top = re.sub(r"\s+", " ", " ".join(w["text"] for w in words if w["y"] < 130))
        group = next((g for g in GROUPS if g in top), None)
        if TITLE not in top or not group or index + 1 not in by_index:
            continue
        spread = [dict(w) for w in words] + [
            {**w, "x": w["x"] + width, "x2": w["x2"] + width} for w in by_index[index + 1][1]
        ]
        lines = lines_of(spread)
        start_y = min(l["y"] for l in lines if l["text"].startswith("Al terminar"))
        body_y = min(l["y"] for l in lines if l["text"].startswith("Así, paso a paso"))

        bullets = [l for l in lines if l["text"].startswith("•") and l["y"] > body_y]
        starts: list[float] = []
        for x in sorted({round(l["x"]) for l in bullets}):
            if not starts or x - starts[-1] > 30:
                starts.append(x)
        columns = [
            {
                "start": s - 20,
                "end": (starts[i + 1] - 20) if i + 1 < len(starts) else float("inf"),
                "header": [],
                "statement": [],
                "items": [],
            }
            for i, s in enumerate(starts)
        ]

        def column_of(x):
            return next((c for c in columns if c["start"] <= x < c["end"]), None)

        headers = [l for l in lines if within(l["h"], HEADER_HEIGHT) and start_y < l["y"] < body_y]
        header_bottom = max(l["y"] for l in headers)
        for l in sorted(lines, key=lambda l: l["y"]):
            if not within(l["h"], BODY_HEIGHT):
                continue
            if l in headers:
                continue
            column = column_of(l["x"])
            if column is None:
                continue
            if header_bottom < l["y"] < body_y:
                column["statement"].append(l["text"])
            elif l["y"] > body_y:
                if l["text"].startswith("•"):
                    column["items"].append({"text": l["text"].lstrip("•").strip(), "page": l["page"]})
                elif column["items"]:
                    column["items"][-1]["text"] += " " + l["text"]
        for l in headers:
            column = column_of((l["x"] + l["x2"]) / 2)
            if column is not None:
                column["header"].append(l)

        if len(columns) != 3:
            sys.exit(f"pág. {index}: {len(columns)} columnas; se esperaban 3")
        out_columns = []
        for column in columns:
            header = clean(" ".join(l["text"] for l in sorted(column["header"], key=lambda l: l["y"])))
            if header not in COMPONENTS:
                sys.exit(f"pág. {index}: título de columna inesperado «{header}»")
            out_columns.append(
                {
                    "label": COMPONENTS[header],
                    "evidences": [clean(" ".join(column["statement"]))],
                    "items": [{"text": clean(i["text"]), "page": i["page"]} for i in column["items"]],
                }
            )
        results.append({"group": group, "page": index, "columns": out_columns})
    return results


def main():
    pdf, prefix, out_path = sys.argv[1:4]
    out = []
    for g in extract(pdf):
        gfrom, gto = GROUPS[g["group"]]
        number = 0
        for column in g["columns"]:
            for item in column["items"]:
                number += 1
                out.append(
                    {
                        "code": f"{prefix}-{gfrom}A{gto[1:]}-{number:02d}",
                        "type": "STANDARD",
                        "area": "CIUDADANAS",
                        "gradeFrom": gfrom,
                        "gradeTo": gto,
                        "number": number,
                        "component": column["label"],
                        "statement": item["text"],
                        "evidences": column["evidences"],
                        "page": item["page"],
                    }
                )
        print(f"{g['group']} (pág. {g['page']}): {[(c['label'][:30], len(c['items'])) for c in g['columns']]}")
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"total: {len(out)} estándares")


if __name__ == "__main__":
    main()
