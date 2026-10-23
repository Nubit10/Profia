"""Produce los archivos del catálogo (curriculum/men/*.json) a partir de los borradores extraídos,
las correcciones documentadas y los metadatos de cada fuente (ADR-0005).

Uso (desde apps/web): python curriculum/tools/build_sources.py

Las correcciones con needsReview quedan listadas en `review.pendingFixes` para la revisión humana.
El campo `review.status` empieza en PENDING; una persona del equipo lo cambia a APPROVED tras
comparar una muestra contra el PDF oficial (SPEC-0004 §11).
"""

import json
import os
import sys

BASE = os.path.join(os.path.dirname(__file__), "..")


def load(path):
    with open(os.path.join(BASE, path), encoding="utf8") as f:
        return json.load(f)


def apply_fixes(items, fixes):
    by_code = {i["code"]: i for i in items}
    pending = []
    for move in fixes.get("moveEvidence", []):
        src, dst = by_code[move["from"]], by_code[move["to"]]
        match = [e for e in src["evidences"] if e.startswith(move["startsWith"])]
        if len(match) != 1:
            sys.exit(f"Corrección inválida: {move['from']} no tiene una evidencia que empiece con «{move['startsWith']}»")
        src["evidences"].remove(match[0])
        dst["evidences"].append(match[0])
        if move.get("needsReview"):
            pending.append(f"{move['from']} → {move['to']}: «{move['startsWith']}…» ({move['reason']})")
    for rep in fixes.get("replaceText", []):
        item = by_code[rep["code"]]
        fields = [("statement", item["statement"])] + [
            (n, e) for n, e in enumerate(item["evidences"])
        ]
        hits = [(k, v) for k, v in fields if rep["find"] in v]
        if len(hits) != 1:
            sys.exit(f"Corrección inválida: «{rep['find']}» aparece {len(hits)} veces en {rep['code']}")
        key, value = hits[0]
        new = value.replace(rep["find"], rep["replace"])
        if key == "statement":
            item["statement"] = new
        else:
            item["evidences"][key] = new
    for group in fixes.get("components", []):
        for code in group["codes"]:
            by_code[code]["component"] = group["component"]
    return pending


def main():
    registry = load("tools/sources.json")
    os.makedirs(os.path.join(BASE, "men"), exist_ok=True)
    for slug, entry in registry.items():
        items = load(entry["draft"])
        fixes = load(entry["fixes"]) if entry.get("fixes") else {}
        pending = apply_fixes(items, fixes)
        for item in items:
            item.setdefault("component", None)
            if len(item["evidences"]) < 2:
                sys.exit(f"{item['code']}: quedó con {len(item['evidences'])} evidencias")
        document = {
            "source": entry["source"],
            "review": {
                "status": "PENDING",
                "reviewedBy": None,
                "reviewedAt": None,
                "method": "Extracción automática del PDF oficial + correcciones documentadas; pendiente revisión humana de una muestra.",
                "pendingFixes": pending,
            },
            "items": items,
        }
        out = os.path.join(BASE, "men", f"{slug}.json")
        with open(out, "w", encoding="utf8") as f:
            json.dump(document, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{slug}: {len(items)} ítems, {len(pending)} correcciones por revisar")


if __name__ == "__main__":
    main()
