"""Extrae los DBA de Transición (V.1) del MEN a JSON borrador (ADR-0005, SPEC-0004).

Uso: python curriculum/tools/extract_transicion.py <archivo.raw.txt> <salida.json>

Estructura del documento: número solo en una línea, enunciado, "Evidencias de aprendizaje:" con
viñetas "•" y "Ejemplo:". El propósito de desarrollo (1, 2 o 3) sale de la página de resumen.
"""

import json
import re
import sys

NUMBER = re.compile(r"^(\d{1,2})$")
BULLET = re.compile(r"^•\s*(.*)$")
INLINE_BULLET = re.compile(r"\s+•\s*")


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text.replace("­", "")).strip()
    return re.sub(r"(\w)- (\w)", r"\1\2", text)


def main():
    raw_path, out_path = sys.argv[1:3]
    pages = open(raw_path, encoding="utf8").read().split("\f")
    items: list[dict] = []
    expected = 1

    for index, page in enumerate(pages):
        lines = [l.strip() for l in page.splitlines()]
        page_no = next((int(l) for l in reversed(lines) if l), index + 1) if any(
            l.isdigit() for l in lines[-3:]
        ) else index + 1
        state = None  # "statement" | "evidences" | None
        current = None
        for i, line in enumerate(lines):
            m = NUMBER.match(line)
            nxt = next((l for l in lines[i + 1 :] if l), "")
            if m and int(m.group(1)) == expected and nxt and not nxt.isdigit():
                current = {"number": expected, "statement": "", "evidences": [], "page": page_no}
                items.append(current)
                expected += 1
                state = "statement"
                continue
            if current is None:
                continue
            if line.startswith("Evidencias de aprendizaje"):
                state = "evidences"
                continue
            if line.startswith("Ejemplo"):
                state = None
                continue
            if not line:
                if state == "statement" and current["statement"]:
                    state = None
                continue
            if state == "statement":
                current["statement"] += " " + line
            elif state == "evidences":
                b = BULLET.match(line)
                parts = INLINE_BULLET.split(b.group(1) if b else line)
                if b or not current["evidences"]:
                    current["evidences"].extend(parts)
                else:
                    current["evidences"][-1] += " " + parts[0]
                    current["evidences"].extend(parts[1:])

    out = []
    for item in items:
        out.append(
            {
                "code": f"MEN-DBA-TRA-V1-{item['number']:02d}",
                "type": "DBA",
                "area": "TRANSICION",
                "grade": "TRANSICION",
                "number": item["number"],
                "statement": clean(item["statement"]),
                "evidences": [clean(e) for e in item["evidences"] if clean(e)],
                "page": item["page"],
            }
        )
    json.dump(out, open(out_path, "w", encoding="utf8"), ensure_ascii=False, indent=2)
    print("total:", len(out))
    for item in out:
        print(item["code"], len(item["evidences"]), "p", item["page"], "|", item["statement"][:90])


if __name__ == "__main__":
    main()
