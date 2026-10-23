"""LLM de prueba determinista (CA-0007-01, SPEC-0008): sin red ni modelos.

Lee la tarea y el contexto del bloque de datos y responde una salida válida, de modo que el
pipeline completo (contexto → schema → validador) se ejercita en CI con resultados predecibles.
"""

import json
from collections.abc import Iterator

from .llm import DATA_END, DATA_START, Completion, Message


def _expand(per_level: dict[str, int]) -> list[str]:
    return [level for level, n in per_level.items() for _ in range(n)]


def _codes(dba: list[dict], i: int) -> list[str]:
    return [dba[i % len(dba)]["codigo"]] if dba else []


def _objectives(data: dict) -> dict:
    count = int(data.get("cantidad", 3))
    dba = data.get("dba", [])
    topic = data.get("tema", {}).get("titulo", "el tema")
    return {
        "suggestions": [
            {
                "statement": (
                    f"Explica con ejemplos propios un aspecto clave de {topic} "
                    f"(sugerencia {i + 1})."
                ),
                "dbaCodes": _codes(dba, i),
            }
            for i in range(count)
        ]
    }


def _question(kind: str, i: int, topic: str, level: str, codes: list[str]) -> dict:
    stem = f"Pregunta {i + 1}: ¿qué afirmación sobre {topic} es correcta?"
    if kind == "MULTIPLE_CHOICE":
        options = [f"Opción {letter} sobre {topic}" for letter in "ABCD"]
        answer = options[i % 4]
    elif kind == "TRUE_FALSE":
        stem = f"Pregunta {i + 1}: {topic} se trabaja en la clase de hoy."
        options, answer = ["Verdadero", "Falso"], "Verdadero"
    else:
        options, answer = [], f"Una idea central de {topic}"
    return {
        "type": kind,
        "stem": stem,
        "options": options,
        "answer": answer,
        "explanation": f"Es la respuesta que corresponde a lo estudiado sobre {topic}.",
        "cognitiveLevel": level,
        "dbaCodes": codes,
    }


def _quiz(data: dict) -> dict:
    topic = data["tema"]["titulo"]
    types = data["tiposPermitidos"]
    levels = _expand(data["preguntasPorNivel"])
    return {
        "title": f"Quiz: {topic}",
        "instructions": "Lee cada pregunta con atención y responde en el espacio indicado.",
        "questions": [
            _question(types[i % len(types)], i, topic, level, _codes(data.get("dba", []), i))
            for i, level in enumerate(levels)
        ],
    }


def _activity(i: int, topic: str, level: str, minutes: int, codes: list[str]) -> dict:
    return {
        "title": f"Actividad {i + 1} sobre {topic}",
        "instructions": (
            f"Observa el ejemplo, resuelve los ejercicios de {topic} y comparte con tu grupo."
        ),
        "durationMinutes": minutes,
        "expectedOutcome": f"Ejercicios resueltos sobre {topic}.",
        "cognitiveLevel": level,
        "dbaCodes": codes,
    }


def _workshop(data: dict) -> dict:
    topic = data["tema"]["titulo"]
    names = data["momentos"]
    levels = _expand(data["actividadesPorNivel"])
    minutes = max(2, data["duracionMinutos"] // len(levels))
    # Una actividad por momento y las sobrantes en el momento central.
    per_moment = [1] * len(names)
    per_moment[len(names) // 2] += len(levels) - len(names)
    moments, i = [], 0
    for name, n in zip(names, per_moment, strict=True):
        acts = [
            _activity(i + k, topic, levels[i + k], minutes, _codes(data.get("dba", []), i + k))
            for k in range(n)
        ]
        moments.append({"name": name, "activities": acts})
        i += n
    return {
        "title": f"Taller: {topic}",
        "purpose": f"Que el estudiante comprenda y use las ideas principales de {topic}.",
        "studentInstructions": "Trabaja en orden cada momento y pide ayuda cuando la necesites.",
        "materials": ["Cuaderno", "Lápiz"],
        "moments": moments,
        "teacherGuidance": ["Acompaña a los grupos y retoma los errores frecuentes al cierre."],
        # SPEC-0010: contenido de las secciones de texto del formato del docente.
        "sectionTexts": [
            {
                "title": s["titulo"],
                "content": f"{s['titulo']}: texto de apoyo sobre {topic} para leer en la clase.",
            }
            for s in data.get("secciones", [])
            if s["tipo"] == "texto"
        ],
    }


def _item(data: dict) -> dict:
    current = data["actual"]
    note = data["indicacionDelDocente"]
    if data["tipo"] == "pregunta":
        kind = current["type"] if current["type"] in data["tiposPermitidos"] else None
        item = _question(
            kind or data["tiposPermitidos"][0],
            0,
            data["tema"]["titulo"],
            current["cognitiveLevel"],
            _codes(data.get("dba", []), 0),
        )
        item["stem"] = f"Versión revisada ({note}): {current['stem']}"
        return {"item": item}
    return {
        "item": {
            **current,
            "title": f"{current['title']} (revisada)",
            "instructions": f"Versión revisada ({note}): {current['instructions']}",
            "dbaCodes": _codes(data.get("dba", []), 0),
        }
    }


def _split_points(points: float, parts: int) -> list[float]:
    """Reparte los puntos en `parts` criterios con un decimal que suman exactamente `points`."""
    tenths = round(points * 10)
    base = [tenths // parts] * parts
    for i in range(tenths - sum(base)):
        base[i] += 1
    return [b / 10 for b in base if b > 0] or [points]


def _exam_question(kind: str, i: int, topic: dict, level: str, codes: list[str], pts: float):
    title = topic["titulo"]
    base = {
        "type": kind,
        "options": [],
        "answer": "",
        "explanation": f"Corresponde a lo estudiado sobre {title}.",
        "pairs": [],
        "distractors": [],
        "criteria": [],
        "topic": topic["clave"],
        "cognitiveLevel": level,
        "dbaCodes": codes,
    }
    if kind in ("MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"):
        q = _question(kind, i, title, level, codes)
        return {**base, **{k: q[k] for k in ("stem", "options", "answer", "explanation")}}
    if kind == "MATCHING":
        return {
            **base,
            "stem": f"Bloque {i + 1}: relaciona cada concepto de {title} con su descripción.",
            "pairs": [
                {"left": f"Concepto {k + 1} de {title} ({i + 1})", "right": f"Descripción {k + 1}"}
                for k in range(4)
            ],
            "distractors": [f"Descripción sobrante {i + 1}"],
        }
    parts = _split_points(pts, 2)
    return {
        **base,
        "stem": f"Pregunta abierta {i + 1}: explica con un ejemplo cómo se usa {title}.",
        "answer": f"Una explicación con un ejemplo correcto de {title}.",
        "criteria": [
            {"description": f"Criterio {k + 1}: explica la idea con claridad", "points": p}
            for k, p in enumerate(parts)
        ],
    }


def _exam_section(data: dict) -> dict:
    section = data["seccion"]
    kind, count, pts = section["tipo"], section["cantidadPreguntas"], section["puntosPorPregunta"]
    topics = {t["clave"]: t for t in data["temas"]}
    levels = _expand(data["preguntasPorNivel"])
    # Primero los temas obligatorios; el resto, en rueda.
    order = [*data["temasObligatorios"], *topics]
    offset = section["numero"] * 100
    return {
        "questions": [
            _exam_question(
                kind,
                offset + i,
                topics[order[i % len(order)]],
                levels[i],
                _codes(data.get("dba", []), i),
                pts,
            )
            for i in range(count)
        ]
    }


def _exam_item(data: dict) -> dict:
    current = data["actual"]
    topic = next(t for t in data["temas"] if t["clave"] == current["topic"])
    item = _exam_question(
        current["type"],
        7,
        topic,
        current["cognitiveLevel"],
        _codes(data.get("dba", []), 0),
        data["puntos"],
    )
    item["stem"] = f"Versión revisada ({data['indicacionDelDocente']}): {current['stem']}"
    return {"item": item}


# Palabras clave para el análisis de formatos de prueba (SPEC-0010).
SOURCE_HINTS = [
    ("sede", "CAMPUS"), ("instituci", "INSTITUTION"), ("colegio", "INSTITUTION"),
    ("docente", "TEACHER"), ("profesor", "TEACHER"), ("area", "SUBJECT"), ("asignatura", "SUBJECT"),
    ("estudiante", "BLANK"), ("alumno", "BLANK"), ("nombre", "BLANK"), ("grado", "GRADE"),
    ("grupo", "GROUP"), ("periodo", "PERIOD"), ("tema", "TOPIC"), ("ano", "YEAR"),
]  # fmt: skip
TEXT_HINTS = ("concept", "teori", "introduc", "criterio", "lectura")
FIXED_HINTS = ("autoevalu", "rubrica", "compromiso", "bibliograf")


def _plain(text: str) -> str:
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn"
    )


def _format(data: dict) -> dict:
    def source(label: str) -> str:
        plain = _plain(label)
        return next((src for hint, src in SOURCE_HINTS if hint in plain), "BLANK")

    def kind(section: dict) -> str:
        plain = _plain(section["titulo"])
        if section["tieneTexto"] and any(h in plain for h in FIXED_HINTS):
            return "FIXED"
        return "TEXT" if any(h in plain for h in TEXT_HINTS) else "ACTIVITIES"

    sections = [{"title": s["titulo"], "kind": kind(s)} for s in data["secciones"]]
    if not any(s["kind"] == "ACTIVITIES" for s in sections):
        next(s for s in sections if s["kind"] != "FIXED")["kind"] = "ACTIVITIES"
    for s in sections:
        s["purpose"] = "" if s["kind"] == "FIXED" else f"Trabajar {s['title'].lower()} en la clase"
    return {
        "header": [{"label": label, "source": source(label)} for label in data["encabezado"]],
        "sections": sections,
    }


TASKS = {
    "quiz": _quiz,
    "taller": _workshop,
    "item": _item,
    "formato": _format,
    "examen_seccion": _exam_section,
    "examen_item": _exam_item,
}


class MockLLM:
    name = "mock"
    model = "mock-llm"

    def generate(
        self, messages: list[Message], *, json_mode: bool, max_tokens: int, max_wait_s: float = 0
    ) -> Completion:
        user = next(m.content for m in messages if m.role == "user")
        data = (
            json.loads(user.split(DATA_START, 1)[1].split(DATA_END, 1)[0])
            if DATA_START in user
            else {}
        )
        out = TASKS.get(data.get("tarea", ""), _objectives)(data)
        return Completion(
            text=json.dumps(out, ensure_ascii=False),
            provider=self.name,
            model=self.model,
            tokens=len(user) // 4,
        )

    def stream(self, messages: list[Message], *, max_tokens: int) -> Iterator[str]:
        yield from self.generate(messages, json_mode=False, max_tokens=max_tokens).text
