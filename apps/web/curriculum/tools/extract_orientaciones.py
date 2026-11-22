"""Extrae los desempeños de las orientaciones pedagógicas del MEN (SPEC-0038 etapa 2, ADR-0022).

Uso: python curriculum/tools/extract_orientaciones.py <documento> <archivo.pdf> <prefijo-code> <salida.json>
     <documento>: tecnologia | educacion-fisica | artistica | filosofia

Requiere `pdfplumber` y `pypdf` (`pip install pdfplumber pypdf`) para las tablas; Tecnología usa
solo `pdftotext`, como los demás extractores.

Cada desempeño es un ítem `ORIENTATION` con su grupo de grados:

- Tecnología (Guía 30, 2008, págs. 16-25): cuatro componentes por grupo de grados; cada uno trae su
  competencia en un recuadro y los desempeños en viñetas. `component` = componente, `statement` =
  desempeño, `evidences` = [competencia].
- Educación Física (Documento 15, 2010, págs. 60-64, tablas giradas): una tabla por grupo de grados
  con tres competencias (motriz, expresiva corporal, axiológica corporal), su indicador para el
  grupo y seis columnas de desempeños. `component` = «Competencia · columna», `evidences` =
  [indicador de la competencia].
- Educación Artística (Documento 16, 2010, pág. 93, tabla girada): competencias (sensibilidad,
  apreciación estética, comunicación) por grupo de grados; cada celda trae varias evidencias de
  desempeño que terminan en «(C. B. n)». `component` = competencia, `evidences` = [] (la sigla de
  competencias básicas se conserva en el enunciado, como en el original).
- Filosofía (Documento 14, 2010, págs. 119-121, tablas giradas): desempeños de las competencias
  crítica, dialógica y creativa en el «Esquema sugerido» (10° y 11°). `component` = competencia,
  `evidences` = [] (las preguntas del esquema son ejemplos y no se copian).

El resultado es un BORRADOR: `verify_orientaciones` lo compara contra el PDF por otro camino.
"""

import io
import json
import re
import sys

from extract_ebc import GROUPS, clean, lines_of, pages, within

GROUP_LABELS = {
    "Primero a Tercero": ("G1", "G3"),
    "Cuarto a Quinto": ("G4", "G5"),
    "Sexto a Séptimo": ("G6", "G7"),
    "Octavo a Noveno": ("G8", "G9"),
    "Décimo a Undécimo": ("G10", "G11"),
}


def _rotated(pdf: str, page_numbers: list[int], degrees: int):
    """Las páginas pedidas giradas (`/Rotate`), como un PDF en memoria para pdfplumber."""
    import pypdf

    reader = pypdf.PdfReader(pdf)
    writer = pypdf.PdfWriter()
    for n in page_numbers:
        page = reader.pages[n - 1]
        if degrees:
            page.rotate(degrees)
        writer.add_page(page)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return buffer


def _tables(pdf: str, page_numbers: list[int], degrees: int):
    import pdfplumber

    with pdfplumber.open(_rotated(pdf, page_numbers, degrees)) as doc:
        for n, page in zip(page_numbers, doc.pages):
            yield n, page.extract_text() or "", page.extract_tables()


def _cell(text: str | None) -> str:
    return clean((text or "").replace("\n", " "))


def tecnologia(pdf: str):
    """Guía 30: pares de páginas (16-17 … 24-25); en cada página, dos columnas."""
    groups = []
    current = None
    for index, width, words in pages(pdf):
        if not 16 <= index <= 25:
            continue
        lines = lines_of(words)
        label = " ".join(l["text"] for l in sorted(lines, key=lambda l: l["y"]) if l["h"] > 25 and l["y"] < 120)
        label = re.sub(r"\s+", " ", label).strip()
        if label in GROUP_LABELS:
            current = {"grades": GROUP_LABELS[label], "label": label, "columns": []}
            groups.append(current)
        if current is None:
            sys.exit(f"pág. {index}: no se encontró el grupo de grados")
        middle = width / 2
        for side in (0, 1):
            col = [l for l in lines if (l["x"] < middle - 10) == (side == 0)]
            header = [l for l in col if within(l["h"], (14.5, 16.5)) and 130 < l["y"] < 175]
            competence = [l for l in col if within(l["h"], (11.0, 12.5))]
            body = [l for l in col if within(l["h"], (9.8, 11.0)) and l["y"] > 230]
            items: list[dict] = []
            for l in sorted(body, key=lambda l: l["y"]):
                if l["text"].startswith("•"):
                    items.append({"text": l["text"].lstrip("•").strip(), "page": index})
                elif items:
                    items[-1]["text"] += " " + l["text"]
            current["columns"].append(
                {
                    "component": clean(" ".join(l["text"] for l in sorted(header, key=lambda l: l["y"]))),
                    "evidences": [clean(" ".join(l["text"] for l in sorted(competence, key=lambda l: l["y"])))],
                    "items": [{"text": clean(i["text"]), "page": i["page"]} for i in items],
                }
            )
    return groups


def educacion_fisica(pdf: str):
    groups = []
    for n, text, tables in _tables(pdf, [60, 61, 62, 63, 64], 90):
        title = next((l for l in text.splitlines() if l.startswith("Grados de")), "")
        label = re.sub(r"^Grados de ", "", title).strip()
        label = label[0].upper() + label[1:] if label else ""
        grades = next((g for k, g in GROUP_LABELS.items() if k.lower() == label.lower()), None)
        if not grades or len(tables) != 1:
            sys.exit(f"pág. {n}: no se encontró la tabla del grupo «{title}»")
        table = tables[0]
        competences, indicators, columns = table[0], table[1], table[2]
        # Las tres competencias ocupan 4, 1 y 1 columnas (celdas combinadas a la derecha vacías).
        owner = []
        for i in range(len(columns)):
            j = i
            while not (competences[j] or "").strip():
                j -= 1
            owner.append(j)
        cols = []
        for i, name in enumerate(columns):
            competence = _cell(competences[owner[i]]).replace("Competencia Motriz", "Competencia motriz")
            cols.append(
                {
                    "component": f"{competence} · {_cell(name)}",
                    "evidences": [_cell(indicators[owner[i]])],
                    "items": [
                        {"text": _cell(row[i]), "page": n} for row in table[3:] if _cell(row[i])
                    ],
                }
            )
        groups.append({"grades": grades, "label": label, "columns": cols})
    return groups


ARTISTICA_GROUPS = [("G1", "G3"), ("G4", "G5"), ("G6", "G7"), ("G8", "G9"), ("G10", "G11")]
# Erratas del original: «((C .B . 1, 3 )», «(C .B . 1, 3) )» y «C.B. 1, 3 )» sin abrir; se conservan.
CB = re.compile(r"\(?\(?\s*C\s*\.\s*B\b[^)]*\)(\s*\))?\.?")


def artistica(pdf: str):
    [(n, _text, tables)] = list(_tables(pdf, [93], 90))
    table = tables[0]
    groups = [{"grades": g, "label": "", "columns": []} for g in ARTISTICA_GROUPS]
    for row in table[1:]:
        competence = _cell(row[0]).capitalize()
        for k, group in enumerate(groups):
            text = _cell(row[1 + k])
            items = []
            start = 0
            for m in CB.finditer(text):
                items.append(text[start : m.end()].strip())
                start = m.end()
            rest = text[start:].strip()
            if rest:
                sys.exit(f"Artística: texto sin «(C. B.)» al final de la celda {competence} {group['grades']}: {rest}")
            group["columns"].append(
                {"component": competence, "evidences": [], "items": [{"text": i, "page": n} for i in items]}
            )
    return groups


def filosofia(pdf: str):
    columns: dict[str, list[dict]] = {}
    for n, _text, tables in _tables(pdf, [119, 120, 121], 270):
        table = tables[0]
        # Tabla girada: las filas salen de abajo arriba y cada celda con el texto al revés.
        rows = [[(c or "")[::-1] for c in r] for r in table if (r[2] or "") and "soñepmeseD" not in r[2]]
        rows.reverse()
        competence = next(_cell(r[3]) for r in rows if (r[3] or "").strip())
        competence = re.sub(r"^Competencia (\w)", lambda m: "Competencia " + m.group(1).lower(), competence)
        columns.setdefault(competence, []).extend({"text": _cell(r[2]), "page": n} for r in rows)
    group = {"grades": ("G10", "G11"), "label": "Décimo a Undécimo", "columns": []}
    for competence, items in columns.items():
        group["columns"].append({"component": competence, "evidences": [], "items": items})
    return [group]


EXTRACTORS = {
    "tecnologia": ("TECNOLOGIA", tecnologia),
    "educacion-fisica": ("EDUCACION_FISICA", educacion_fisica),
    "artistica": ("ARTISTICA", artistica),
    "filosofia": ("FILOSOFIA", filosofia),
}


def main():
    document, pdf, prefix, out_path = sys.argv[1:5]
    area, extract = EXTRACTORS[document]
    out = []
    for g in extract(pdf):
        gfrom, gto = g["grades"]
        number = 0
        for column in g["columns"]:
            for item in column["items"]:
                number += 1
                out.append(
                    {
                        "code": f"{prefix}-{gfrom}A{gto[1:]}-{number:02d}",
                        "type": "ORIENTATION",
                        "area": area,
                        "gradeFrom": gfrom,
                        "gradeTo": gto,
                        "number": number,
                        "component": column["component"],
                        "statement": item["text"],
                        "evidences": column["evidences"],
                        "page": item["page"],
                    }
                )
        print(f"{gfrom}-{gto}: {[(c['component'][:40], len(c['items'])) for c in g['columns']]}")
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"total: {len(out)} desempeños")


if __name__ == "__main__":
    main()
