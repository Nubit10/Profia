"""Extrae los Estándares Básicos de Competencias en Lenguas Extranjeras: Inglés (Guía 22, MEN 2006).

Uso: python curriculum/tools/extract_guia22.py <archivo.pdf> <prefijo-code> <salida.json>

La guía viene en dos PDF oficiales: el primero trae 1°-3° y 4°-5° (págs. 18-21) y el segundo 6°-7°,
8°-9° y 10°-11° (págs. 1-6). Cada grupo ocupa dos páginas enfrentadas con cinco columnas (Escucha,
Lectura, Escritura, Monólogos, Conversación). Cada viñeta es un estándar específico y lleva a la
derecha los números de las competencias que desarrolla (1 lingüística, 2 pragmática,
3 sociolingüística, según las «Referencias» de la misma página).

Cada viñeta es un ítem `STANDARD` (SPEC-0037): `component` = la habilidad; `statement` = el
estándar, literal; `evidences` = las competencias por su nombre en la guía.
"""

import json
import re
import sys

from extract_ebc import clean, lines_of, pages

GROUPS = {"1 a 3": ("G1", "G3"), "4 a 5": ("G4", "G5"), "6 a 7": ("G6", "G7"), "8 a 9": ("G8", "G9"), "10 a 11": ("G10", "G11")}
SKILLS = ["Escucha", "Lectura", "Escritura", "Monólogos", "Conversación"]
COMPETENCES = {"1": "Competencia lingüística", "2": "Competencia pragmática", "3": "Competencia sociolingüística"}
BODY_TOP = 190  # las viñetas empiezan debajo de los títulos de columna (y ≈ 150)
NUMBERS = re.compile(r"^\d([\s,.]+\d)*\.?$")  # «1, 2. 3» (errata del original) también


def extract(pdf: str):
    all_pages = list(pages(pdf))
    by_index = {index: (width, words) for index, width, words in all_pages}
    results = []
    for index, width, words in all_pages:
        top = re.sub(r"\s+", " ", " ".join(w["text"] for w in words if w["y"] < 80))
        group = next((g for g in GROUPS if re.search(rf"(?<!\d){g.replace(' ', r'\s*')}(?!\d)", top.replace("a", " a ").replace("  ", " "))), None)
        if not group or index + 1 not in by_index or "Escucha" not in " ".join(w["text"] for w in words):
            continue
        spread = [dict(w) for w in words] + [
            {**w, "x": w["x"] + width, "x2": w["x2"] + width} for w in by_index[index + 1][1]
        ]
        lines = lines_of(spread)
        headers = sorted(
            [l for l in lines if l["text"].strip() in SKILLS and 130 < l["y"] < 180], key=lambda l: l["x"]
        )
        bullets = [l for l in lines if l["text"].startswith("•") and l["y"] >= BODY_TOP]
        starts = []
        for x in sorted({round(l["x"]) for l in bullets}):
            if not starts or x - starts[-1] > 30:
                starts.append(x)
        columns = [
            {
                "start": s - 15,
                "end": (starts[i + 1] - 15) if i + 1 < len(starts) else float("inf"),
                "items": [],
            }
            for i, s in enumerate(starts)
        ]
        if len(columns) != len(SKILLS) or len(headers) != len(SKILLS):
            sys.exit(f"pág. {index}: {len(columns)} columnas y {len(headers)} títulos; se esperaban 5")
        body = [l for l in lines if l["y"] >= BODY_TOP and l["y"] < 600]
        for l in sorted(body, key=lambda l: (l["y"], l["x"])):
            column = next((c for c in columns if c["start"] <= l["x"] < c["end"]), None)
            if column is None:
                continue
            text = l["text"].strip()
            if text.startswith("•"):
                column["items"].append({"text": text.lstrip("•").strip(), "numbers": "", "page": l["page"]})
            elif column["items"] and NUMBERS.match(text):
                column["items"][-1]["numbers"] = text
            elif column["items"]:
                # La línea puede traer los números al final («… mi entorno. 2, 3»).
                m = re.match(r"^(.*?)\s+(\d([\s,.]+\d)*)\.?$", text)
                if m and not column["items"][-1]["numbers"]:
                    column["items"][-1]["text"] += " " + m.group(1)
                    column["items"][-1]["numbers"] = m.group(2)
                else:
                    column["items"][-1]["text"] += " " + text
        for item in (i for c in columns for i in c["items"]):
            # Los números también pueden quedar pegados al final de la primera línea.
            m = re.match(r"^(.*?)\s+(\d([\s,.]+\d)*)\.?$", item["text"])
            if m and not item["numbers"]:
                item["text"], item["numbers"] = m.group(1), m.group(2)
        results.append({"group": group, "page": index, "columns": list(zip(SKILLS, columns))})
    return results


def main():
    pdf, prefix, out_path = sys.argv[1:4]
    out = []
    for g in extract(pdf):
        gfrom, gto = GROUPS[g["group"]]
        number = 0
        for skill, column in g["columns"]:
            for item in column["items"]:
                number += 1
                numbers = re.findall(r"\d", item["numbers"])
                if not numbers:
                    print(f"  sin competencias: {skill} · {item['text'][:60]}")
                out.append(
                    {
                        "code": f"{prefix}-{gfrom}A{gto[1:]}-{number:02d}",
                        "type": "STANDARD",
                        "area": "INGLES",
                        "gradeFrom": gfrom,
                        "gradeTo": gto,
                        "number": number,
                        "component": skill,
                        "statement": clean(item["text"]),
                        "evidences": [COMPETENCES[n] for n in numbers],
                        "page": item["page"],
                    }
                )
        print(f"{g['group']} (pág. {g['page']}): {[(s, len(c['items'])) for s, c in g['columns']]}")
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"total: {len(out)} estándares")


if __name__ == "__main__":
    main()
