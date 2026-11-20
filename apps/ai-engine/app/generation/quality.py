"""Calidad de las preguntas (SPEC-0021 Parte B, ADR-0016).

Reglas deterministas, sin llamar al modelo, sobre las preguntas de un quiz o de una sección de
examen. Devuelven dos listas:

- `errors`: defectos claros (RN-07, RN-09, RN-10 claros, RN-11). Van a la reparación; si persisten,
  la generación sale igual y se registran como avisos (RN-12).
- `notes`: casos dudosos (RN-10). Nunca van a la reparación; solo se registran.

La posición de la respuesta correcta (RN-08) no es un error: `balance_positions` la corrige
reordenando las opciones.

Cambiar un umbral o una lista es una versión nueva de las reglas (`QUALITY_RULES_VERSION`).
"""

import hashlib
import random
import re
from dataclasses import dataclass, field
from typing import Protocol

from .pipeline import norm, words

QUALITY_RULES_VERSION = "quality.v1"

# RN-07
LONGEST_SHARE = 0.5
LONGEST_MIN_QUESTIONS = 4
LONGER_RATIO = 1.5
LONGER_MIN_CHARS = 30
# RN-08
POSITION_SHARE = 0.4
POSITION_MAX_RUN = 3  # 4 seguidas en la misma posición ya es un error
POSITION_MIN_QUESTIONS = 4
# RN-09
DISTRACTOR_MAX_QUESTIONS = 2
DISTRACTOR_MIN_CHARS = 4
# RN-11: máximo de palabras de la pregunta según el grado.
STEM_MAX_WORDS = ((2, 25), (5, 40), (9, 60), (11, 80))

# RN-10: solo contradicciones claras. El verbo es la primera palabra de la pregunta.
LOW_VERBS = {
    "define", "defina", "definir", "nombra", "nombre", "enumera", "enumere", "menciona",
    "mencione", "cita", "cite", "lista", "escribe el nombre", "que es", "cual es la definicion",
    "como se llama",
}  # fmt: skip
HIGH_VERBS = {
    "justifica", "justifique", "argumenta", "argumente", "evalua", "evalue", "valora", "valore",
    "disena", "disene", "crea", "cree", "inventa", "invente", "propon", "proponga", "critica",
    "critique", "defiende", "defienda",
}  # fmt: skip
# Verbos de reconocer: en Analizar o más son dudosos, no un error.
DOUBTFUL_HIGH = {
    "identifica", "identifique", "senala", "senale", "marca", "marque", "selecciona", "seleccione",
    "subraya", "subraye",
}  # fmt: skip
HIGH_LEVELS = {"ANALYZE", "EVALUATE", "CREATE"}
LEVEL_NAMES = {
    "REMEMBER": "Recordar",
    "UNDERSTAND": "Comprender",
    "APPLY": "Aplicar",
    "ANALYZE": "Analizar",
    "EVALUATE": "Evaluar",
    "CREATE": "Crear",
}


class Question(Protocol):
    type: str
    stem: str
    options: list[str]
    answer: str
    cognitiveLevel: str  # noqa: N815


@dataclass
class QualityReport:
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# --- Utilidades ------------------------------------------------------------------------------


def max_words_for(grade: str) -> int:
    """Jardín y Transición cuentan como el primer tramo; un grado sin número, como el último."""
    text = norm(grade)
    if "jardin" in text or "transicion" in text:
        return STEM_MAX_WORDS[0][1]
    match = re.search(r"\d+", text)
    if not match:
        return STEM_MAX_WORDS[-1][1]
    number = int(match.group(0))
    for upto, limit in STEM_MAX_WORDS:
        if number <= upto:
            return limit
    return STEM_MAX_WORDS[-1][1]


def question_part(stem: str) -> str:
    """RN-11: con varios párrafos, el contexto va antes y la pregunta es el último."""
    paragraphs = [p for p in re.split(r"\n\s*\n|\n", stem) if p.strip()]
    return paragraphs[-1] if paragraphs else stem


def _lead(stem: str) -> str:
    """Las primeras palabras de la pregunta, sin signos, para comparar con las listas."""
    return " ".join(words(question_part(stem))[:4])


def _starts_with(lead: str, verbs: set[str]) -> str | None:
    for verb in sorted(verbs, key=len, reverse=True):
        if lead == verb or lead.startswith(verb + " "):
            return verb
    return None


def _is_mc(q: Question) -> bool:
    return q.type == "MULTIPLE_CHOICE" and len(q.options) >= 3


def _answer_index(q: Question) -> int:
    target = norm(q.answer)
    for i, option in enumerate(q.options):
        if norm(option) == target:
            return i
    return -1


def _number(text: str) -> float | None:
    cleaned = text.strip().replace("−", "-").replace(",", ".").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def has_natural_order(options: list[str]) -> bool:
    """RN-08: opciones numéricas en orden (creciente o decreciente) no se reordenan."""
    numbers = [_number(o) for o in options]
    if any(n is None for n in numbers):
        return False
    values = [n for n in numbers if n is not None]
    return values == sorted(values) or values == sorted(values, reverse=True)


def _is_trivial_distractor(text: str) -> bool:
    plain = norm(text)
    return len(plain) < DISTRACTOR_MIN_CHARS or _number(text) is not None


# --- Reglas ----------------------------------------------------------------------------------


def _longest_errors(questions: list[Question], labels: list[str]) -> list[str]:
    errors: list[str] = []
    mc = [(q, label) for q, label in zip(questions, labels, strict=True) if _is_mc(q)]
    longest = 0
    for q, label in mc:
        index = _answer_index(q)
        if index < 0:
            continue
        correct = q.options[index].strip()
        others = [o.strip() for i, o in enumerate(q.options) if i != index]
        if all(len(correct) > len(o) for o in others):
            longest += 1
        average = sum(len(o) for o in others) / len(others)
        if len(correct) > LONGER_MIN_CHARS and len(correct) > LONGER_RATIO * average:
            errors.append(
                f"{label}: la respuesta correcta es mucho más larga que las otras opciones; "
                "iguala su largo para que no se adivine"
            )
    if len(mc) >= LONGEST_MIN_QUESTIONS and longest > LONGEST_SHARE * len(mc):
        errors.append(
            f"La respuesta correcta es la opción más larga en {longest} de {len(mc)} preguntas de "
            "selección múltiple; varía el largo de las opciones"
        )
    return errors


def _distractor_errors(questions: list[Question], labels: list[str]) -> list[str]:
    seen: dict[str, list[str]] = {}
    original: dict[str, str] = {}
    for q, label in zip(questions, labels, strict=True):
        if not _is_mc(q):
            continue
        index = _answer_index(q)
        for i, option in enumerate(q.options):
            if i == index or _is_trivial_distractor(option):
                continue
            key = norm(option)
            original.setdefault(key, option.strip())
            if label not in seen.setdefault(key, []):
                seen[key].append(label)
    return [
        f"El distractor «{original[key]}» se repite en {len(found)} preguntas "
        f"({', '.join(found)}); usa distractores propios de cada pregunta"
        for key, found in seen.items()
        if len(found) > DISTRACTOR_MAX_QUESTIONS
    ]


def _verb_report(q: Question, label: str, report: QualityReport) -> None:
    lead = _lead(q.stem)
    level = q.cognitiveLevel
    name = LEVEL_NAMES.get(level, level)
    if level in HIGH_LEVELS:
        verb = _starts_with(lead, LOW_VERBS)
        if verb:
            report.errors.append(
                f"{label}: es de nivel {name} pero solo pide «{verb}»; pide analizar, comparar o "
                "justificar, o cambia el nivel"
            )
        elif verb := _starts_with(lead, DOUBTFUL_HIGH):
            report.notes.append(f"{label}: nivel {name} con el verbo «{verb}»")
    elif level == "REMEMBER":
        verb = _starts_with(lead, HIGH_VERBS)
        if verb:
            report.errors.append(
                f"{label}: es de nivel Recordar pero pide «{verb}»; cambia el nivel o la pregunta"
            )


def _length_errors(q: Question, label: str, limit: int) -> list[str]:
    count = len(question_part(q.stem).split())
    if count <= limit:
        return []
    return [
        f"{label}: la pregunta tiene {count} palabras y para este grado el máximo es {limit}; "
        "acórtala o pon el contexto en un párrafo aparte"
    ]


def check_questions(
    questions: list[Question], grade: str, labels: list[str] | None = None
) -> QualityReport:
    """RN-07, RN-09, RN-10 y RN-11 sobre un quiz o una sección de examen."""
    labels = labels or [f"Pregunta {i}" for i in range(1, len(questions) + 1)]
    report = QualityReport()
    report.errors += _longest_errors(questions, labels)
    report.errors += _distractor_errors(questions, labels)
    limit = max_words_for(grade)
    for q, label in zip(questions, labels, strict=True):
        _verb_report(q, label, report)
        report.errors += _length_errors(q, label, limit)
    return report


# --- RN-08: posición de la correcta ------------------------------------------------------------


def _position_ok(positions: list[int], option_counts: list[int]) -> bool:
    if len(positions) < POSITION_MIN_QUESTIONS:
        return True
    for p in set(positions):
        if positions.count(p) > POSITION_SHARE * len(positions):
            # Con pocas opciones el umbral puede ser imposible de cumplir (p. ej. 3 opciones y
            # 4 preguntas): basta con que ninguna posición tenga más que el reparto parejo.
            fair = -(-len(positions) // min(option_counts))
            if positions.count(p) > fair:
                return False
    run = 1
    for a, b in zip(positions, positions[1:], strict=False):
        run = run + 1 if a == b else 1
        if run > POSITION_MAX_RUN:
            return False
    return True


def balance_positions[Q](questions: list[Q], seed: str) -> list[Q]:
    """Reordena las opciones si la posición de la correcta no cumple RN-08.

    Determinista (semilla de los enunciados) y mínimo: mueve la correcta intercambiándola con la
    opción de la posición elegida, la menos usada hasta ahí sin repetir tres veces seguidas. Las
    preguntas con opciones en orden natural no se tocan. Si ya cumplían, se devuelven igual.
    """
    mc = [i for i, q in enumerate(questions) if _is_mc(q) and _answer_index(q) >= 0]  # type: ignore[arg-type]
    positions = {i: _answer_index(questions[i]) for i in mc}  # type: ignore[arg-type]
    counts = [len(questions[i].options) for i in mc]  # type: ignore[attr-defined]
    if _position_ok([positions[i] for i in mc], counts):
        return questions
    # Orden reproducible, no criptográfico.
    rng = random.Random(int(hashlib.sha256(seed.encode()).hexdigest()[:16], 16))  # noqa: S311
    result = list(questions)
    used: dict[int, int] = {}
    previous: list[int] = []
    for i in mc:
        q = questions[i]
        if not has_natural_order(q.options):  # type: ignore[attr-defined]
            n = len(q.options)  # type: ignore[attr-defined]
            choices = [p for p in range(n) if previous[-2:] != [p, p]]
            low = min(used.get(p, 0) for p in choices)
            target = rng.choice([p for p in choices if used.get(p, 0) == low])
            options = list(q.options)  # type: ignore[attr-defined]
            current = positions[i]
            options[current], options[target] = options[target], options[current]
            result[i] = q.model_copy(update={"options": options})  # type: ignore[attr-defined]
            positions[i] = target
        used[positions[i]] = used.get(positions[i], 0) + 1
        previous.append(positions[i])
    return result
