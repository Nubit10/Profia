"""Extrae DBA (enunciado + evidencias) de los PDF del MEN maquetados a dos columnas (SPEC-0036).

Uso: python curriculum/tools/extract_dba_columns.py <archivo.pdf> <area> <prefijo-code> <salida.json>

Ciencias Naturales y Ciencias Sociales (V.1) ponen dos DBA por página, uno por columna, y un DBA
puede seguir en la otra columna. `pdftotext` sin coordenadas mezcla las columnas, así que aquí se
leen las líneas con su posición (`pdftotext -bbox-layout`), se ordena cada página columna por
columna y se reconoce:

- el número del DBA («3.»), que puede venir solo o pegado a una línea del enunciado;
- el enunciado: el bloque de líneas seguidas (sin saltos grandes) junto al número;
- «Evidencias de aprendizaje» y las viñetas («q» en Naturales, «l» en Sociales); una línea con
  sangría sigue la viñeta anterior, también al pasar de columna o de página;
- «Ejemplo»: lo que sigue (casi siempre imágenes) no se extrae; se consulta en la página del PDF.

Se descartan los encabezados y pies de página y el texto suelto de los dibujos (brújulas y relojes de
Sociales). El resultado es un BORRADOR: `verify_columns.py` lo compara contra el PDF y una persona
revisa una muestra (SPEC-0004 §11). `page` es la página del archivo PDF (la del enlace `#page=`).
"""

import html
import json
import re
import subprocess
import sys

LINE = re.compile(
    r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S
)
PAGE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
WORD_BOX = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>'
)
NUMBER = re.compile(r"^(\d{1,2})\s*\.\s*(.*)$")
BULLET = re.compile(r"^[ql]\s+(?=\S)")
GRADE = re.compile(r"Grad\s*o\s*(\d{1,2})\s*[º°o]")
EVIDENCE_HEADER = "Evidencias de aprendizaje"
NOISE = re.compile(r"^[\dNSEO]{1,3}$")  # números y letras sueltas de los dibujos
FURNITURE = re.compile(
    r"Derechos Básicos de Aprendizaje •|Ciencias (Naturales|Sociales) •|\.indd|\d+:\d+ [ap]\.m\."
)
BLOCK_GAP = 19.0  # puntos: más que esto entre dos líneas = otro bloque
INDENT = 6.0  # puntos: sangría de la continuación de una viñeta
MIN_WORD_HEIGHT = 11.0  # puntos: el texto de los DBA mide 12–13,2; los rótulos, hasta 10,8

WARNINGS: list[str] = []
# Guiones del original que caen al final de una línea (revisados contra el PDF): se conservan.
KEEP_HYPHEN = {
    "boyle- mariotte": "-",
    "arena- gravilla": "-",
    "capitalista- comunista": "-",
    "lejos- entre": "- ",  # «(distancia - cerca o lejos- entre…)»: guion que cierra el inciso
}


HYPHEN_JOINS: list[str] = []


def clean(text: str) -> str:
    text = text.replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"\s+", " ", text).strip()

    def join(m):
        word = m.group(0)
        if word.lower() in KEEP_HYPHEN:
            return word.replace("- ", KEEP_HYPHEN[word.lower()])
        HYPHEN_JOINS.append(word)
        return word.replace("- ", "")

    # Une las palabras partidas al final de la línea («compren- sión»), salvo los compuestos
    # que llevan guion en el original (KEEP_HYPHEN, revisados a mano contra el PDF).
    text = re.sub(r"\w+- \w+", join, text)
    # Una barra al final de la línea («inflar/ explotar») une las dos palabras.
    return re.sub(r"(\w)/ (\w)", r"\1/\2", text)


def read_pages(pdf: str):
    """Páginas con sus líneas. Se arman por columna a partir de las palabras: las líneas de
    `pdftotext` a veces juntan texto de las dos columnas («1. de energía… 2. Explica»)."""
    xml = subprocess.run(
        ["pdftotext", "-bbox", "-enc", "UTF-8", pdf, "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    for index, page in enumerate(PAGE.finditer(xml), start=1):
        width, height = float(page.group(1)), float(page.group(2))
        boxes = [
            {
                "x": float(m.group(1)),
                "y": float(m.group(2)),
                "x2": float(m.group(3)),
                "h": float(m.group(4)) - float(m.group(2)),
                "text": html.unescape(m.group(5)),
            }
            for m in WORD_BOX.finditer(page.group(3))
        ]

        def glued(w):
            """Si una palabra pequeña es un subíndice químico (el 2 de H2O), la palabra a la que va
            pegada: solo dígitos, justo a la derecha de un símbolo químico y un poco más abajo."""
            if not w["text"].isdigit():
                return None
            return next(
                (
                    o
                    for o in boxes
                    if o["h"] >= MIN_WORD_HEIGHT
                    and re.fullmatch(r"\(?[A-Z][a-z]?", o["text"])  # símbolo químico: H, C, Na…
                    and 0 <= w["x"] - o["x2"] < 0.5
                    and 3 < w["y"] - o["y"] < 9
                ),
                None,
            )

        for w in boxes:
            if w["h"] < MIN_WORD_HEIGHT and (base := glued(w)):
                w["y"], w["sub"] = base["y"], True  # el subíndice va en la línea de su palabra

        # Rótulos de los dibujos (brújulas, relojes): letra diminuta y solo números o N/S/E/O.
        # Un subíndice (el 2 de H2O) también es diminuto, pero va pegado a otra palabra: se queda.
        words = [
            w for w in boxes if not (w["h"] < MIN_WORD_HEIGHT and NOISE.match(w["text"]) and not w.get("sub"))
        ]
        lines = []
        for column in (0, 1):
            col = sorted(
                (w for w in words if (w["x"] < width / 2) == (column == 0)),
                key=lambda w: (w["y"], w["x"]),
            )
            for w in col:
                line = next((l for l in lines if l["col"] == column and abs(l["y"] - w["y"]) <= 3.5), None)
                if line is None:
                    lines.append({"col": column, "x": w["x"], "y": w["y"], "words": [w]})
                else:
                    line["words"].append(w)
                    line["x"] = min(line["x"], w["x"])
        for l in lines:
            text, previous = "", None
            for w in sorted(l["words"], key=lambda w: w["x"]):
                # Sin espacio entre palabras pegadas (subíndices: H2O, CO2).
                text += ("" if w.get("sub") or (previous and previous.get("sub")) else " ") + w["text"]
                previous = w
            l["text"] = text.strip()
            del l["words"]
        yield index, width, height, lines


def page_grade(lines) -> int | None:
    top = " ".join(l["text"] for l in sorted(lines, key=lambda l: l["x"]) if l["y"] < 60)
    match = GRADE.search(top.replace(" ", " "))
    return int(match.group(1)) if match else None


def content(lines, height):
    keep = []
    for l in lines:
        t = l["text"]
        if not t or l["y"] < 100 or l["y"] > height - 40:
            continue
        if FURNITURE.search(t) or all(NOISE.match(tok) for tok in t.split()):
            continue
        keep.append(l)
    return keep


def bullet_positions(pages) -> dict[tuple[int, int], float]:
    """x más común de las viñetas por (columna, página par/impar): la sangría se mide contra eso."""
    seen: dict[tuple[int, int], dict[float, int]] = {}
    for page_no, width, _height, lines in pages:
        for l in lines:
            if BULLET.match(l["text"]):
                key = (l["col"], page_no % 2)
                bucket = seen.setdefault(key, {})
                bucket[round(l["x"])] = bucket.get(round(l["x"]), 0) + 1
    return {k: max(v, key=v.get) for k, v in seen.items()}


def extract(pdf: str):
    pages = list(read_pages(pdf))
    bullet_x = bullet_positions(pages)
    items: list[dict] = []
    current: dict | None = None
    grade = 0
    last_number = 0
    mode = "idle"  # idle | statement | evidence | example

    for page_no, width, height, raw in pages:
        lines = content(raw, height)
        has_dba = any("Evidenciasdeaprendizaje" in re.sub(r"\s", "", l["text"]) for l in lines)
        if not has_dba and not (mode == "evidence" and page_grade(raw)):
            # Solo se sigue una evidencia en otra página si esa página es de DBA (tiene grado).
            mode = "idle" if not has_dba else mode
            continue
        header_grade = page_grade(raw)
        split = width / 2
        columns = [
            sorted([l for l in lines if l["col"] == 0], key=lambda l: l["y"]),
            sorted([l for l in lines if l["col"] == 1], key=lambda l: l["y"]),
        ]
        for col_index, col in enumerate(columns):
            col_bullet_x = bullet_x.get((col_index, page_no % 2))
            pending: list[dict] = []  # líneas sueltas que pueden ser el enunciado siguiente
            last_y = None  # y de la última línea de evidencia en esta columna (None = arriba)
            for l in col:
                t = l["text"]
                number = NUMBER.match(t)
                if t.startswith("Ejemplo"):
                    mode, pending = "example", []
                    continue
                if re.sub(r"\s", "", t).startswith("Evidenciasdeaprendizaje"):
                    if current is None:
                        WARNINGS.append(f"pág. {page_no}: evidencias sin DBA")
                        continue
                    if mode == "statement":
                        current["statement"] += " " + " ".join(p["text"] for p in pending)
                    mode, pending = "evidence", []
                    continue
                if number and (int(number.group(1)) in (last_number + 1, 1)):
                    n = int(number.group(1))
                    if n == 1:
                        grade += 1
                        if header_grade and header_grade != grade:
                            WARNINGS.append(
                                f"pág. {page_no}: el encabezado dice grado {header_grade}, "
                                f"la numeración da {grade}"
                            )
                    # El enunciado es el último bloque de líneas seguidas antes del número.
                    block: list[dict] = []
                    for p in reversed(pending):
                        if block and block[0]["y"] - p["y"] > BLOCK_GAP:
                            break
                        block.insert(0, p)
                    if block and l["y"] - block[-1]["y"] > BLOCK_GAP:
                        block = []
                    current = {
                        "grade": grade,
                        "number": n,
                        "statement": " ".join(p["text"] for p in block + [{"text": number.group(2)}]),
                        "evidences": [],
                        "page": page_no,
                    }
                    items.append(current)
                    last_number, mode, pending = n, "statement", []
                    continue
                if BULLET.match(t):
                    if mode == "statement" and current and pending:
                        current["statement"] += " " + " ".join(p["text"] for p in pending)
                        pending = []
                    if current is None or mode not in ("evidence",):
                        WARNINGS.append(f"pág. {page_no}: viñeta fuera de evidencias: {t[:50]}")
                        if current is None:
                            continue
                    current["evidences"].append(BULLET.sub("", t))
                    mode, last_y = "evidence", l["y"]
                    continue
                # Línea de texto sin marca.
                if mode == "evidence" and current and current["evidences"]:
                    close = last_y is None or l["y"] - last_y <= BLOCK_GAP
                    if close and col_bullet_x is not None and l["x"] >= col_bullet_x + INDENT:
                        current["evidences"][-1] += " " + t
                        last_y = l["y"]
                        continue
                if mode == "statement":
                    pending.append(l)
                    continue
                pending.append(l)
                if mode == "evidence":
                    mode = "idle"
            if mode == "statement" and pending and current:
                current["statement"] += " " + " ".join(p["text"] for p in pending)

    for item in items:
        item["statement"] = clean(item["statement"])
        item["evidences"] = [clean(e) for e in item["evidences"] if clean(e)]
    return items


def main():
    pdf, area, prefix, out_path = sys.argv[1:5]
    items = extract(pdf)
    out = []
    problems = []
    counts: dict[int, int] = {}
    for item in items:
        counts[item["grade"]] = counts.get(item["grade"], 0) + 1
        code = f"{prefix}-G{item['grade']}-{item['number']:02d}"
        if len(item["evidences"]) < 2:
            problems.append(f"{code}: {len(item['evidences'])} evidencias")
        out.append(
            {
                "code": code,
                "type": "DBA",
                "area": area,
                "grade": f"G{item['grade']}",
                "number": item["number"],
                "statement": item["statement"],
                "evidences": item["evidences"],
                "page": item["page"],
            }
        )
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"grados: {dict(sorted(counts.items()))}  total: {len(out)}")
    print("problemas:", problems or "ninguno")
    print("advertencias:", WARNINGS or "ninguna")
    print("palabras unidas al quitar el guion de fin de línea:", sorted(set(HYPHEN_JOINS)) or "ninguna")


if __name__ == "__main__":
    main()
