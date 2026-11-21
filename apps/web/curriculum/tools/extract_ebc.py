"""Extrae los Estándares Básicos de Competencias de Ciencias Naturales y Ciencias Sociales (SPEC-0036).

Uso: python curriculum/tools/extract_ebc.py <archivo.pdf> <area> <prefijo-code> <salida.json>

Fuente: «Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas»
(MEN, 2006), págs. 122-141. Cada grupo de grados ocupa dos páginas enfrentadas:

- arriba, los estándares generales («Al terminar tercer grado…», uno por recuadro);
- debajo, columnas con viñetas: «…me aproximo al conocimiento como científico(a)…», las
  subcolumnas de «…manejo conocimientos propios de las ciencias…» (historia y culturas, entorno
  vivo…) y «…desarrollo compromisos personales y sociales».

Cada viñeta (acción de pensamiento y producción) es un ítem `STANDARD` con su rango de grados
(decisión del product owner, SPEC-0036 pregunta 1, opción a):

- `component`: la columna («Manejo conocimientos propios de las ciencias sociales: Relaciones con
  la historia y las culturas»);
- `statement`: la acción, literal;
- `evidences`: el estándar general al que apunta. Las subcolumnas se emparejan con los estándares
  en orden; «me aproximo» y «compromisos» sirven a todos los estándares del grupo.

El resultado es un BORRADOR: `verify_columns.verify_ebc` lo compara contra el PDF.
"""

import html
import json
import re
import subprocess
import sys

PAGE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
WORD_BOX = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>'
)
GROUPS = {
    "Primero a tercero": ("G1", "G3"),
    "Cuarto a quinto": ("G4", "G5"),
    "Sexto a séptimo": ("G6", "G7"),
    "Octavo a noveno": ("G8", "G9"),
    "Décimo a undécimo": ("G10", "G11"),
}
AREA_TITLE = {"CIENCIAS_NATURALES": "Ciencias Naturales", "CIENCIAS_SOCIALES": "Ciencias Sociales"}
BODY_HEIGHT = (8.5, 10.0)  # texto de estándares y viñetas (9,2 pt)
HEADER_HEIGHT = (10.0, 11.5)  # títulos de columna (10,8 pt)
STANDARDS_BAND = (150, 222)  # y de los recuadros de estándares generales
HEADERS_BAND = (222, 284)  # y de los títulos de columna
BODY_TOP = 284

HYPHEN_JOINS: list[str] = []
# Guiones del original que caen al final de una línea (revisados contra el PDF): se conservan.
KEEP_HYPHEN = {"ético- políticas": "-"}


def clean(text: str) -> str:
    # Las ligaduras «ﬁ»/«ﬂ» salen con un espacio detrás («Identiﬁ co»): van dentro de la palabra.
    text = re.sub(r"ﬁ\s+(?=[a-záéíóúñ])", "fi", text).replace("ﬁ", "fi")
    text = re.sub(r"ﬂ\s+(?=[a-záéíóúñ])", "fl", text).replace("ﬂ", "fl")
    text = re.sub(r"\s+", " ", text.replace("­", "")).strip()
    # En los títulos la ligadura sale como «fi» suelto: «científi co(a)».
    text = re.sub(r"(\w)(fi|fl) (?=[a-záéíóúñ])", r"\1\2", text)
    # Guion de fin de línea antes de mayúscula: es un compuesto («Europa-América- África»).
    text = re.sub(r"(\w)- (?=[A-ZÁÉÍÓÚÑ])", r"\1-", text)

    def join(m):
        word = m.group(0)
        if word.lower() in KEEP_HYPHEN:
            return word.replace("- ", KEEP_HYPHEN[word.lower()])
        HYPHEN_JOINS.append(word)
        return word.replace("- ", "")

    return re.sub(r"\w+- [a-záéíóúñ]\w*", join, text)


def pages(pdf: str):
    xml = subprocess.run(
        ["pdftotext", "-bbox", "-enc", "UTF-8", pdf, "-"], capture_output=True, text=True, check=True
    ).stdout
    for index, page in enumerate(PAGE.finditer(xml), start=1):
        words = [
            {
                "x": float(m.group(1)),
                "y": float(m.group(2)),
                "x2": float(m.group(3)),
                "h": float(m.group(4)) - float(m.group(2)),
                "text": html.unescape(m.group(5)),
                "page": index,
            }
            for m in WORD_BOX.finditer(page.group(3))
        ]
        yield index, float(page.group(1)), words


def lines_of(words):
    """Agrupa palabras en líneas (misma altura de letra y misma y)."""
    lines: list[dict] = []
    for w in sorted(words, key=lambda w: (w["x"], w["y"])):
        line = next(
            # «Identiﬁ» + «co»: lo que sigue a una ligadura sale un poco más arriba o abajo.
            (
                l
                for l in lines
                if abs(l["y"] - w["y"]) < 4
                and -3 <= w["x"] - l["x2"] < 12
                # Una viñeta siempre empieza línea: en 10°-11° las columnas casi se tocan.
                and not (w["text"].startswith("•") and w["x"] - l["x2"] > 2)
            ),
            None,
        )
        if line is None:
            lines.append({**w, "words": [w]})
        else:
            line["words"].append(w)
            line["x2"] = w["x2"]
    for l in lines:
        l["text"] = " ".join(w["text"] for w in l["words"])
    return lines


def within(h, band):
    return band[0] <= h <= band[1]


def extract(pdf: str, area: str):
    all_pages = list(pages(pdf))
    by_index = {index: (width, words) for index, width, words in all_pages}
    title = f"Estándares Básicos de Competencias en {AREA_TITLE[area]}"
    spreads = []
    for index, width, words in all_pages:
        text = " ".join(w["text"] for w in words if w["y"] < 130)
        if title in re.sub(r"\s+", " ", text):
            group = next((g for g in GROUPS if g in text), None)
            if group:
                spreads.append((index, group))

    results = []
    for first, group in spreads:
        width = by_index[first][0]
        # Las dos páginas enfrentadas como una sola: la de la derecha se corre un ancho de página.
        words = [dict(w) for w in by_index[first][1]] + [
            {**w, "x": w["x"] + width, "x2": w["x2"] + width} for w in by_index[first + 1][1]
        ]
        lines = lines_of(words)

        # 1. Estándares generales: recuadros arriba, uno por columna de texto.
        std_lines = [
            l for l in lines if within(l["h"], BODY_HEIGHT) and STANDARDS_BAND[0] <= l["y"] <= STANDARDS_BAND[1]
        ]
        boxes: list[list[dict]] = []
        for l in sorted(std_lines, key=lambda l: (l["x"], l["y"])):
            box = next((b for b in boxes if abs(b[0]["x"] - l["x"]) < 12), None)
            (box.append(l) if box is not None else boxes.append([l]))
        standards: list[str] = []
        for b in sorted(boxes, key=lambda b: b[0]["x"]):
            text = clean(" ".join(l["text"] for l in sorted(b, key=lambda l: l["y"])))
            # Un estándar que sigue en la página de enfrente empieza en minúscula.
            if standards and text[:1].islower():
                standards[-1] = clean(standards[-1] + " " + text)
            else:
                standards.append(text)

        # 2. Columnas: por la x de las viñetas.
        bullets = [l for l in lines if l["text"].startswith("•") and l["y"] >= BODY_TOP]
        xs = sorted({round(l["x"]) for l in bullets})
        starts: list[float] = []
        for x in xs:
            if not starts or x - starts[-1] > 30:
                starts.append(x)
        columns = []
        for i, start in enumerate(starts):
            end = starts[i + 1] - 20 if i + 1 < len(starts) else float("inf")
            columns.append({"start": start - 20, "end": end, "header": [], "items": []})

        def column_of(x):
            return next((c for c in columns if c["start"] <= x < c["end"]), None)

        # 3. Títulos de columna (centrados en su recuadro).
        for l in lines:
            if within(l["h"], HEADER_HEIGHT) and HEADERS_BAND[0] <= l["y"] <= HEADERS_BAND[1]:
                if l["text"].startswith("…manejo") or l["text"].startswith("propios de"):
                    continue
                center = (l["x"] + l["x2"]) / 2
                column = column_of(center) or column_of(l["x"])
                if column is not None:
                    column["header"].append(l)

        # 4. Viñetas y sus continuaciones, por columna y de arriba abajo.
        body = [l for l in lines if within(l["h"], BODY_HEIGHT) and l["y"] >= BODY_TOP]
        for l in sorted(body, key=lambda l: l["y"]):
            column = column_of(l["x"])
            if column is None:
                continue
            if l["text"].startswith("•"):
                column["items"].append({"text": l["text"].lstrip("•").strip(), "page": l["page"]})
            elif column["items"]:
                column["items"][-1]["text"] += " " + l["text"]

        science = "ciencias sociales" if area == "CIENCIAS_SOCIALES" else "ciencias naturales"
        labeled = []
        for column in columns:
            header = clean(" ".join(l["text"] for l in sorted(column["header"], key=lambda l: l["y"])))
            header = header.lstrip("…").strip()
            # Dos niveles de título: «Entorno vivo» sobre «Procesos biológicos».
            header = re.sub(r"^(Entorno \w+) (Procesos .+)$", r"\1 · \2", header)
            if header.startswith("me aproximo"):
                kind = "aproximo"
                label = header[0].upper() + header[1:]
            elif header.startswith("desarrollo compromisos"):
                kind = "compromisos"
                label = header[0].upper() + header[1:]
            else:
                kind = "manejo"
                label = f"Manejo conocimientos propios de las {science}: {header}"
            labeled.append((kind, label, column))

        sub = [c for c in labeled if c[0] == "manejo"]
        paired = len(sub) == len(standards)
        results.append(
            {
                "group": group,
                "grades": GROUPS[group],
                "page": first,
                "standards": standards,
                "paired": paired,
                "columns": [
                    {
                        "kind": kind,
                        "label": label,
                        "evidences": [standards[sub.index((kind, label, column))]]
                        if kind == "manejo" and paired
                        else standards,
                        "items": [{"text": clean(i["text"]), "page": i["page"]} for i in column["items"]],
                    }
                    for kind, label, column in labeled
                ],
            }
        )
    return results


def main():
    pdf, area, prefix, out_path = sys.argv[1:5]
    groups = extract(pdf, area)
    out = []
    for g in groups:
        gfrom, gto = g["grades"]
        number = 0
        for column in g["columns"]:
            for item in column["items"]:
                number += 1
                out.append(
                    {
                        "code": f"{prefix}-{gfrom}A{gto[1:]}-{number:02d}",
                        "type": "STANDARD",
                        "area": area,
                        "gradeFrom": gfrom,
                        "gradeTo": gto,
                        "number": number,
                        "component": column["label"],
                        "statement": item["text"],
                        "evidences": column["evidences"],
                        "page": item["page"],
                    }
                )
        print(
            f"{g['group']} (pág. {g['page']}): {len(g['standards'])} estándares, "
            f"{[(c['label'][:45], len(c['items'])) for c in g['columns']]}"
            + ("" if g["paired"] else "  ← subcolumnas y estándares no coinciden: cada acción lleva todos")
        )
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"total: {len(out)} acciones")
    print("palabras unidas al quitar el guion de fin de línea:", sorted(set(HYPHEN_JOINS)) or "ninguna")


if __name__ == "__main__":
    main()
