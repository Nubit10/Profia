"""Verifica los DBA extraídos de PDF a dos columnas contra el PDF oficial (SPEC-0036, ADR-0005).

Uso (desde apps/web): python curriculum/tools/verify_columns.py <archivo.pdf> <catalogo.json> [correcciones.json]
`npm run curriculum:verify` lo usa para las fuentes con `"layout": "columns"` en tools/sources.json.

Lee el PDF por un camino distinto al del extractor: recorta cada columna de cada página con
`pdftotext -x/-W` (el corte es el inicio de la columna derecha) y concatena el texto en orden de
lectura. Comprueba:

1. Fidelidad: cada enunciado y cada evidencia aparece literal en ese texto (solo se normalizan
   espacios, guiones de fin de línea y los rótulos sueltos de los dibujos, que se quitan en los
   dos lados). Las excepciones son las correcciones documentadas (`replaceText` en tools/fixes).
2. Completitud: el número de viñetas de evidencias del PDF (sin contar las de los ejemplos) coincide
   con el número de evidencias del catálogo.
3. Numeración: los DBA de cada grado van de 1 a N sin saltos.

Sale con código 1 si algo falla.
"""

import json
import re
import subprocess
import sys

from extract_dba_columns import KEEP_HYPHEN

WORD_BOX = re.compile(r'<word xMin="([\d.]+)" yMin="[\d.]+" xMax="[\d.]+" yMax="[\d.]+">')
PAGE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
NOISE = re.compile(r"(?<!\S)[\dNSEO]{1,3}(?!\S)")
DBA_NUMBER = re.compile(r"(?<!\S)\d{1,2}\s*\.(?=\s|[A-Za-zÁÉÍÓÚáéíóúñ])")
TOP, BOTTOM = 100, 40  # encabezado y pie de página (los mismos márgenes del extractor)
BULLET_LINE = re.compile(r"^\s*[ql]\s+[A-ZÁÉÍÓÚÑ¿¡(]", re.M)


def norm(text: str) -> str:
    text = text.replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"(\w)-\s+(?=[A-ZÁÉÍÓÚÑ])", r"\1-", text)

    def join(word: str) -> str:
        return word.replace("- ", KEEP_HYPHEN[word.lower()]) if word.lower() in KEEP_HYPHEN else word.replace("- ", "")

    text = re.sub(r"\w+-\s+\w+", lambda m: join(re.sub(r"\s+", " ", m.group(0))), text)
    text = NOISE.sub(" ", text)
    text = DBA_NUMBER.sub(" ", text)  # el número grande del DBA cae en medio del enunciado
    # Se compara sin espacios: el PDF a veces separa letras («C o m p a r a») o pega palabras
    # («Comprendelaimportancia…»), y el recorte de columnas mueve algún espacio. Letras, signos y
    # guiones tienen que coincidir uno a uno.
    return re.sub(r"\s+", "", text)


def column_texts(pdf: str) -> list[str]:
    xml = subprocess.run(["pdftotext", "-bbox", pdf, "-"], capture_output=True, text=True, check=True).stdout
    texts = []
    for index, page in enumerate(PAGE.finditer(xml), start=1):
        width, height = float(page.group(1)), float(page.group(2))
        right = [float(x) for x in WORD_BOX.findall(page.group(3)) if float(x) >= width / 2]
        split = int(min(right) - 1) if right else int(width / 2)
        for x, w in ((0, split), (split, int(width) - split + 1)):
            texts.append(
                subprocess.run(
                    ["pdftotext", "-enc", "UTF-8", "-f", str(index), "-l", str(index),
                     "-x", str(x), "-y", str(TOP), "-W", str(w), "-H", str(int(height) - TOP - BOTTOM), pdf, "-"],
                    capture_output=True, text=True, check=True,
                ).stdout
            )
    return texts


def verify(pdf: str, items: list[dict], fixes: dict) -> bool:
    """True si el catálogo coincide con el PDF. Imprime cada diferencia."""
    replaced = {(r["code"], r["replace"]) for r in fixes.get("replaceText", [])}
    visual = {v["code"] for v in fixes.get("verifiedVisually", [])}
    columns = column_texts(pdf)
    corpus = norm(" ".join(columns))
    failed = False

    for item in items:
        for kind, text in [("enunciado", item["statement"])] + [
            (f"evidencia {n + 1}", e) for n, e in enumerate(item["evidences"])
        ]:
            if norm(text) in corpus:
                continue
            if any(code == item["code"] and fix in text for code, fix in replaced):
                continue
            if item["code"] in visual:
                print(f"    revisado contra la imagen: {item['code']} {kind}")
                continue
            failed = True
            print(f"    NO LITERAL {item['code']} {kind}: {text[:90]}")

    # Viñetas de evidencias: todas las de las páginas de DBA, salvo las que van dentro de un ejemplo
    # (desde «Ejemplo» hasta el siguiente «Evidencias de aprendizaje» de la columna).
    bullets = 0
    for column in columns:
        in_example = False
        for line in column.splitlines():
            squashed = re.sub(r"\s", "", line)
            if line.strip().startswith("Ejemplo"):
                in_example = True
            elif squashed.startswith("Evidenciasdeaprendizaje"):
                in_example = False
            elif BULLET_LINE.match(line) and not in_example:
                bullets += 1
    evidences = sum(len(i["evidences"]) for i in items)
    if bullets != evidences:
        failed = True
    print(f"    viñetas en el PDF: {bullets} · evidencias en el catálogo: {evidences}")

    by_grade: dict[str, list[int]] = {}
    for item in items:
        by_grade.setdefault(item["grade"], []).append(item["number"])
    for grade, numbers in by_grade.items():
        if numbers != list(range(1, len(numbers) + 1)):
            failed = True
            print(f"    numeración con saltos en {grade}: {numbers}")
    return not failed


def main():
    pdf, catalog_path = sys.argv[1:3]
    fixes = json.load(open(sys.argv[3], encoding="utf8")) if len(sys.argv) > 3 else {}
    catalog = json.load(open(catalog_path, encoding="utf8"))
    items = catalog["items"] if isinstance(catalog, dict) else catalog
    ok = verify(pdf, items, fixes)
    print("verificación:", "OK" if ok else "FALLA", f"({len(items)} DBA)")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()


def verify_ebc(pdf: str, items: list[dict], fixes: dict) -> bool:
    """Estándares (SPEC-0036): cada acción y cada estándar general aparece letra por letra en el
    texto de sus páginas, y el número de viñetas «•» de esas páginas es el número de acciones."""
    first, last = min(i["page"] for i in items) - 1, max(i["page"] for i in items) + 1
    raw = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-f", str(first), "-l", str(last), pdf, "-"],
        capture_output=True, text=True, check=True,
    ).stdout
    corpus = norm(raw)
    replaced = {(r["code"], r["replace"]) for r in fixes.get("replaceText", [])}
    visual = {v["code"] for v in fixes.get("verifiedVisually", [])}
    failed = False
    checked: set[str] = set()
    for item in items:
        for kind, text in [("acción", item["statement"])] + [("estándar", e) for e in item["evidences"]]:
            if kind == "estándar" and text in checked:
                continue
            checked.add(text)
            if norm(text) in corpus or any(c == item["code"] and f in text for c, f in replaced):
                continue
            if item["code"] in visual:
                print(f"    revisado contra la imagen: {item['code']} {kind}")
                continue
            failed = True
            print(f"    NO LITERAL {item['code']} {kind}: {text[:90]}")
    # Las páginas de un área: cuenta las viñetas en el rango de páginas de sus ítems.
    pages = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-f", str(first + 1), "-l", str(last - 1), pdf, "-"],
        capture_output=True, text=True, check=True,
    ).stdout
    bullets = len(re.findall(r"(?m)^\s*•", pages))
    if bullets != len(items):
        failed = True
    print(f"    viñetas en el PDF: {bullets} · acciones en el catálogo: {len(items)}")
    return not failed


def verify_esquema(pdf: str, items: list[dict], fixes: dict) -> bool:
    """DBA de Inglés 6°-11° (SPEC-0038): recorta con pdftotext solo la franja «DERECHOS BÁSICOS
    INGLÉS» de cada página (sin META, FUNCIONES ni OBJETIVOS) y comprueba que cada DBA aparece
    letra por letra en ella y que el número de viñetas de la franja es el número de DBA del grado.
    Los tramos con la fuente ilegible se aceptan solo con su corrección documentada (replaceText)."""
    import extract_esquema_ingles as esquema
    from extract_ebc import pages

    replaced = {(r["code"], r["replace"]) for r in fixes.get("replaceText", [])}
    by_page: dict[int, list[dict]] = {}
    for item in items:
        by_page.setdefault(item["page"], []).append(item)
    failed = False
    for index, _width, words in pages(pdf):
        if index not in by_page:
            continue
        b = esquema.band(words)
        if b is None:
            print(f"    pág. {index}: no se encontró la franja de DBA")
            failed = True
            continue
        crop = esquema.crop_text(pdf, index, b[2], b[3])
        corpus = norm(crop)
        for item in by_page[index]:
            text = item["statement"]
            for code, rep in replaced:
                if code == item["code"]:
                    text = text.replace(rep, "\0")
            # Sin el tramo corregido, el resto del enunciado sigue siendo literal.
            if not all(norm(part) in corpus for part in text.split("\0") if part.strip()):
                failed = True
                print(f"    NO LITERAL {item['code']}: {item['statement'][:90]}")
        bullets = len(re.findall(r"•", crop))
        if bullets != len(by_page[index]):
            failed = True
        grade = by_page[index][0]["grade"]
        numbers = [i["number"] for i in by_page[index]]
        if numbers != list(range(1, len(numbers) + 1)):
            failed = True
            print(f"    numeración con saltos en {grade}")
        print(f"    pág. {index} ({grade}): viñetas {bullets} · DBA {len(by_page[index])}")
    return not failed


def verify_orientacion(pdf: str, items: list[dict], fixes: dict, expected: int | None = None) -> bool:
    """Orientaciones en tablas (SPEC-0038 etapa 2): el extractor lee las celdas con pdfplumber sobre
    las páginas giradas; aquí se lee el orden del contenido del PDF (`pdftotext -raw`) y cada
    desempeño y cada indicador tiene que aparecer letra por letra. Además, el número de desempeños
    es el que trae el documento (`expected` en sources.json) y, en Artística, el de siglas «C. B.»."""
    pages = sorted({i["page"] for i in items})
    raw = "".join(
        subprocess.run(
            ["pdftotext", "-enc", "UTF-8", "-raw", "-f", str(p), "-l", str(p), pdf, "-"],
            capture_output=True, text=True, check=True,
        ).stdout
        for p in pages
    )
    corpus = norm(raw)
    replaced = {(r["code"], r["replace"]) for r in fixes.get("replaceText", [])}
    failed = False
    checked: set[str] = set()
    for item in items:
        for kind, text in [("desempeño", item["statement"])] + [("indicador", e) for e in item["evidences"]]:
            if kind == "indicador" and text in checked:
                continue
            checked.add(text)
            if norm(text) in corpus or any(c == item["code"] and f in text for c, f in replaced):
                continue
            failed = True
            print(f"    NO LITERAL {item['code']} {kind}: {text[:90]}")
    if expected is not None and len(items) != expected:
        failed = True
    cb = len(re.findall(r"C\s*\.\s*B\b", raw))
    if items[0]["area"] == "ARTISTICA" and cb != len(items):
        failed = True
    print(f"    desempeños: {len(items)}" + (f" (esperados {expected})" if expected else "") + (f" · siglas C. B.: {cb}" if items[0]["area"] == "ARTISTICA" else ""))
    return not failed
