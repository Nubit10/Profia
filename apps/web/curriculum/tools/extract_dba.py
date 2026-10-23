"""Extrae DBA (enunciado + evidencias) de los PDF oficiales del MEN a JSON (ADR-0005, SPEC-0004).

Uso: python curriculum/tools/extract_dba.py <archivo.raw.txt> <area> <prefijo-code> <salida.json>

El texto de entrada es la salida de `pdftotext -enc UTF-8` (sin -layout). El resultado es un
BORRADOR que una persona revisa contra el PDF antes de publicarlo. Los ejemplos no se extraen
(contienen tablas y figuras que la extracción desarma); cada ítem guarda la página del PDF.
"""

import json
import re
import sys

GRADE_HEADER = re.compile(r"•\s*Grado\s+(\d{1,2})\s*[º°o]?")
STATEMENT = re.compile(r"^(\d{1,2})\s*\.\s*([A-ZÁÉÍÓÚÑ¿¡].*)$")
EVIDENCE_HEADER = "Evidencias de aprendizaje"
BULLET = re.compile(r"^m\s*(?=[A-ZÁÉÍÓÚÑ¿¡])(.*)$")
INLINE_BULLET = re.compile(r"\s+m\s*(?=[A-ZÁÉÍÓÚÑ¿¡])")
WARNINGS: list[str] = []
ORPHANS: list[tuple] = []  # viñetas al inicio de página asignadas al ítem anterior: revisar
NOISE = re.compile(r"^(Derechos Básicos de Aprendizaje|Matemáticas|Lenguaje)\b.*(V\.\s*2|Grado)")


def clean(text: str) -> str:
    text = text.replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"\s+", " ", text).strip()
    # Une palabras partidas con guion al final de línea ("compren- sión").
    return re.sub(r"(\w)- (\w)", r"\1\2", text)


def printed_page_number(lines: list[str], fallback: int) -> int:
    for line in reversed(lines):
        if line.strip():
            return int(line.strip()) if line.strip().isdigit() else fallback
    return fallback


def extract(raw: str) -> dict[int, list[dict]]:
    grades: dict[int, list[dict]] = {}
    current_grade: int | None = None
    last_item: dict | None = None

    for index, page in enumerate(raw.split("\f")):
        lines = page.splitlines()
        page_no = printed_page_number(lines, index + 1)
        header = next((GRADE_HEADER.search(l) for l in lines[:4] if GRADE_HEADER.search(l)), None)
        if header:
            grade = int(header.group(1))
        elif current_grade is not None and EVIDENCE_HEADER in page:
            grade = current_grade  # página sin encabezado de grado (p. ej. pág. 86 de Matemáticas)
            WARNINGS.append(f"pág. {page_no}: sin encabezado de grado; se asume grado {grade}")
        else:
            continue
        if grade != current_grade:
            current_grade, last_item = grade, None
            grades.setdefault(grade, [])
        items = grades[grade]
        expected = len(items) + 1

        page_items: list[dict] = []  # enunciados de esta página, en orden
        blocks: list[list[str]] = []  # bloques de evidencias, en orden
        block: list[str] | None = None
        orphan: list[str] | None = None  # evidencias que continúan desde la página anterior
        statement: dict | None = None  # enunciado que aún puede continuar en la línea siguiente
        anchored = False  # ya apareció un enunciado, encabezado o ejemplo en esta página

        def close_block():
            nonlocal block
            if block:
                blocks.append(block)
            block = None

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                statement = None
                close_block()  # en páginas a dos columnas, una línea en blanco separa bloques
                continue
            if NOISE.match(line) or GRADE_HEADER.search(line) or line.isdigit():
                continue  # encabezados de página y números de página sueltos
            m = STATEMENT.match(line)
            if m and int(m.group(1)) == expected:
                close_block()
                text, sep, _ = m.group(2).partition(EVIDENCE_HEADER)
                statement = {
                    "number": expected,
                    "statement": text,
                    "evidences": [],
                    "page": page_no,
                }
                page_items.append(statement)
                items.append(statement)
                expected += 1
                anchored = True
                if sep:
                    statement = None  # el encabezado venía en la misma línea
                continue
            if line == EVIDENCE_HEADER:
                close_block()
                statement = None
                anchored = True
                continue
            if line.startswith("Ejemplo"):
                close_block()
                statement = None
                anchored = True
                continue
            bullet = BULLET.match(line)
            if bullet:
                statement = None
                parts = INLINE_BULLET.split(bullet.group(1))
                if not anchored:
                    orphan = orphan or []
                    orphan.extend(parts)
                    continue
                if block is None:
                    block = []
                block.extend(parts)
                continue
            if statement is not None:
                # El enunciado sigue en la línea siguiente; a veces el encabezado viene pegado al final.
                text, sep, _ = line.partition(EVIDENCE_HEADER)
                statement["statement"] += " " + text
                if sep:
                    statement = None
                continue
            first, *more = INLINE_BULLET.split(line)
            if block:
                block[-1] += " " + first  # viñeta partida en varias líneas
                block.extend(more)
            elif orphan and not anchored:
                orphan[-1] += " " + first
                orphan.extend(more)
        close_block()

        if orphan and last_item is not None:
            last_item["evidences"].extend(orphan)
            ORPHANS.append((grade, page_no, last_item["number"], [o[:70] for o in orphan]))
        # Empareja enunciados y bloques en orden. Si sobra un bloque al inicio, continúa el último
        # ítem de la página anterior.
        extra = len(blocks) - len(page_items)
        if extra > 0 and last_item is not None:
            for b in blocks[:extra]:
                last_item["evidences"].extend(b)
            blocks = blocks[extra:]
        if len(blocks) != len(page_items):
            WARNINGS.append(
                f"grado {grade}, pág. {page_no}: {len(page_items)} enunciados y {len(blocks)} bloques"
            )
        for item, b in zip(page_items, blocks):
            item["evidences"].extend(b)
        if page_items:
            last_item = page_items[-1]

    for items in grades.values():
        for item in items:
            item["statement"] = clean(item["statement"])
            item["evidences"] = [clean(e) for e in item["evidences"] if clean(e)]
    return grades


def main():
    raw_path, area, prefix, out_path = sys.argv[1:5]
    with open(raw_path, encoding="utf8") as f:
        grades = extract(f.read())
    items = []
    problems = []
    for grade in sorted(grades):
        for item in grades[grade]:
            code = f"{prefix}-G{grade}-{item['number']:02d}"
            if len(item["evidences"]) < 2:
                problems.append(f"{code}: {len(item['evidences'])} evidencias")
            items.append(
                {
                    "code": code,
                    "type": "DBA",
                    "area": area,
                    "grade": f"G{grade}",
                    "number": item["number"],
                    "statement": item["statement"],
                    "evidences": item["evidences"],
                    "page": item["page"],
                }
            )
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    counts = {g: len(v) for g, v in sorted(grades.items())}
    print(f"grados: {counts}  total: {len(items)}")
    print("problemas:", problems or "ninguno")
    print("advertencias:", WARNINGS or "ninguna")
    for o in ORPHANS:
        print("continuación:", o)


if __name__ == "__main__":
    main()
