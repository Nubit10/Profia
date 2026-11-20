"""Calidad de las preguntas (SPEC-0021 Parte B)."""

import json

import pytest

from app.generation.exams import ExamRequest, generate_exam
from app.generation.pipeline import GenerationInvalidError
from app.generation.quality import (
    QUALITY_RULES_VERSION,
    balance_positions,
    check_questions,
    has_natural_order,
    max_words_for,
)
from app.generation.resources import QuizQuestion, QuizRequest, generate_quiz
from app.providers import MockLLM
from tests.test_exams import EXAM
from tests.test_resources import QUIZ, ScriptedLLM, quiz_out

CODE = "MEN-DBA-MAT-V2-G6-01"


def q(
    stem: str,
    options: list[str],
    answer_index: int = 0,
    level: str = "APPLY",
    kind: str = "MULTIPLE_CHOICE",
) -> dict:
    return {
        "type": kind,
        "stem": stem,
        "options": options,
        "answer": options[answer_index] if options else "Una respuesta",
        "explanation": "Porque así se ubica en la recta numérica.",
        "cognitiveLevel": level,
        "dbaCodes": [CODE],
    }


def model(data: dict) -> QuizQuestion:
    return QuizQuestion(**data)


def varied(i: int) -> list[str]:
    """Cuatro opciones del mismo largo, propias de la pregunta `i`."""
    return [f"Respuesta {letter} número {i:02d}" for letter in "ABCD"]


MC_QUIZ = {**QUIZ, "questionTypes": ["MULTIPLE_CHOICE"], "cognitiveDistribution": {"APPLY": 100}}


def test_ca_0021_10_la_correcta_no_puede_ser_casi_siempre_la_mas_larga():
    questions = []
    for i in range(6):
        options = [f"Corta {i}a", f"Corta {i}b", f"Corta {i}c", f"Un poco más larga {i}"]
        questions.append(
            model(q(f"¿Qué número cumple la condición {i}?", options, 3 if i < 4 else 0))
        )
    errors = check_questions(questions, "6°").errors
    assert any("la opción más larga en 4 de 6" in e for e in errors)
    # Por pregunta: la correcta mucho más larga que el promedio de los distractores.
    long_one = model(
        q(
            "¿Cuál es el resultado?",
            ["El resultado es menos tres porque está a la izquierda del cero", "3", "0", "1"],
        )
    )
    assert any("mucho más larga" in e for e in check_questions([long_one], "6°").errors)
    # Mensaje de reparación: el modelo recibe el error concreto.
    bad = [q(f"¿Qué número cumple la condición {i}?", x.options, 3 if i < 4 else 0)
           for i, x in enumerate(questions[:4])]  # fmt: skip
    good = [q(f"¿Qué número cumple la condición {i}?", varied(i), i % 4) for i in range(4)]
    llm = ScriptedLLM(quiz_out(bad), quiz_out(good))
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert result.attempts == 2
    assert "la opción más larga" in llm.calls[1][-1].content


def test_ca_0021_11_reordena_la_posicion_de_la_correcta_sin_llamar_al_modelo():
    questions = [q(f"¿Qué número cumple la condición {i}?", varied(i), 1) for i in range(8)]
    llm = ScriptedLLM(quiz_out(questions))
    result = generate_quiz(llm, QuizRequest(**{**MC_QUIZ, "itemCount": 8}))
    assert len(llm.calls) == 1
    out = result.value.questions
    positions = [x.options.index(x.answer) for x in out]
    assert max(positions.count(p) for p in set(positions)) <= 0.4 * len(positions)
    assert all(positions[i : i + 4] != [positions[i]] * 4 for i in range(len(positions) - 3))
    for original, new in zip(questions, out, strict=True):
        assert new.answer == original["answer"]
        assert sorted(new.options) == sorted(original["options"])
    # Determinista: la misma entrada da el mismo orden.
    again = generate_quiz(
        ScriptedLLM(quiz_out(questions)), QuizRequest(**{**MC_QUIZ, "itemCount": 8})
    )
    assert [x.options for x in again.value.questions] == [x.options for x in out]


def test_ca_0021_11_no_reordena_opciones_en_orden_natural():
    assert has_natural_order(["2", "4", "6", "8"])
    assert has_natural_order(["−3", "−1", "0", "2"])
    assert not has_natural_order(["4", "2", "8", "6"])
    questions = [model(q(f"¿Cuánto es {i} + {i}?", ["2", "4", "6", "8"], 1)) for i in range(5)]
    assert balance_positions(questions, "semilla") == questions
    # Las que ya cumplen no se tocan.
    fine = [model(q(f"¿Pregunta {i}?", varied(i), i % 4)) for i in range(8)]
    assert balance_positions(fine, "semilla") == fine


def test_ca_0021_12_distractores_repetidos_entre_preguntas():
    shared = ["El cero", "Un número positivo", "Un número negativo", "Ninguno de ellos es"]
    questions = [model(q(f"¿Qué es {i}?", [f"Correcta {i}", *shared[:3]])) for i in range(3)]
    errors = check_questions(questions, "6°").errors
    assert any("«Un número positivo» se repite en 3 preguntas" in e for e in errors)
    # Los distractores numéricos o muy cortos sí se pueden repetir.
    numbers = [model(q(f"¿Cuánto es {i} + 1?", [str(i + 1), "10", "20", "30"])) for i in range(4)]
    assert not any("se repite" in e for e in check_questions(numbers, "6°").errors)


def test_ca_0021_13_verbo_y_nivel_cognitivo():
    analyze = model(q("Define qué es una fracción.", varied(1), level="ANALYZE"))
    assert any("solo pide «define»" in e for e in check_questions([analyze], "6°").errors)
    remember = model(q("Justifica por qué −3 es menor que 2.", varied(2), level="REMEMBER"))
    assert any("pide «justifica»" in e for e in check_questions([remember], "6°").errors)
    doubtful = model(q("Identifica el número mayor de la lista.", varied(3), level="ANALYZE"))
    report = check_questions([doubtful], "6°")
    assert report.errors == []
    assert any("«identifica»" in n for n in report.notes)
    fine = model(q("Compara −3 y 2 y explica cuál es mayor.", varied(4), level="ANALYZE"))
    assert check_questions([fine], "6°") == check_questions([], "6°")


def test_ca_0021_14_largo_de_la_pregunta_segun_el_grado():
    stem = " ".join(["palabra"] * 44) + " ¿cuál?"
    question = model(q(stem, varied(1)))
    assert any(
        "45 palabras" in e and "máximo es 25" in e for e in check_questions([question], "2°").errors
    )
    assert not any("palabras" in e for e in check_questions([question], "7°").errors)
    # El contexto en un párrafo aparte no cuenta.
    with_context = model(q(" ".join(["texto"] * 60) + "\n\n¿Qué número es mayor?", varied(2)))
    assert not any("palabras" in e for e in check_questions([with_context], "2°").errors)
    assert max_words_for("Transición") == 25
    assert max_words_for("Jardín") == 25
    assert max_words_for("5°") == 40
    assert max_words_for("11°") == 80


def test_ca_0021_15_solo_calidad_no_tumba_la_generacion():
    long_stem = " ".join(["palabra"] * 70) + " ¿cuál?"
    bad = [
        q(long_stem if i == 0 else f"¿Qué número cumple {i}?", varied(i), i % 4) for i in range(4)
    ]
    llm = ScriptedLLM(quiz_out(bad), quiz_out(bad), quiz_out(bad))
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert result.attempts == 3
    assert len(result.value.questions) == 4
    assert any("71 palabras" in w for w in result.warnings)
    # Con errores de estructura sigue fallando como hoy.
    broken = [q(f"¿Qué número cumple {i}?", varied(i), i % 4) for i in range(3)]
    with pytest.raises(GenerationInvalidError):
        generate_quiz(ScriptedLLM(*[quiz_out(broken)] * 3), QuizRequest(**MC_QUIZ))


def test_ca_0021_15_usa_el_ultimo_intento_que_solo_tenia_errores_de_calidad():
    long_stem = " ".join(["palabra"] * 70) + " ¿cuál?"
    soft = [
        q(long_stem if i == 0 else f"¿Qué número cumple {i}?", varied(i), i % 4) for i in range(4)
    ]
    broken = soft[:3]
    result = generate_quiz(
        ScriptedLLM(quiz_out(soft), quiz_out(broken), quiz_out(broken)), QuizRequest(**MC_QUIZ)
    )
    assert len(result.value.questions) == 4
    assert result.warnings


def test_ca_0021_16_mock_cumple_las_reglas_en_quiz_y_examen():
    quiz = generate_quiz(MockLLM(), QuizRequest(**{**MC_QUIZ, "itemCount": 10}))
    assert quiz.attempts == 1
    assert quiz.warnings == ()
    exam = generate_exam(MockLLM(), ExamRequest(**EXAM))
    assert all(c.attempts == 1 for c in exam.calls)
    assert exam.warnings == ()


def test_ca_0021_api_devuelve_los_avisos_y_la_version_de_las_reglas(api, auth):
    response = api.post("/v1/generation/quiz", json=MC_QUIZ, headers=auth)
    assert response.status_code == 200
    meta = response.json()["meta"]
    assert meta["qualityWarnings"] == []
    assert meta["qualityRulesVersion"] == QUALITY_RULES_VERSION
    exam = api.post("/v1/generation/exam", json=EXAM, headers=auth).json()["meta"]
    assert exam["qualityRulesVersion"] == QUALITY_RULES_VERSION
    assert all(c["qualityWarnings"] == [] for c in exam["calls"])


REAL_CASE = {
    "id": "a1b2c3d4e5f60718",
    "type": "QUIZ",
    "subject": "Matemáticas",
    "gradeLabel": "6°",
    "topic": "La recta numérica",
    "topicDescription": "Orden de enteros",
    "objectives": ["Compara números enteros usando la recta numérica."],
    "dba": [{"code": CODE, "statement": "Interpreta los números enteros.", "evidences": []}],
    "difficulty": "BASIC",
    "durationMinutes": 30,
    "itemCount": 4,
    "questionTypes": ["MULTIPLE_CHOICE"],
    "structure": None,
    "cognitiveDistribution": {"APPLY": 100},
    "rating": 2,
    "complaints": [{"item": "¿Cuál es el menor?", "comment": "La correcta siempre es la B"}],
}


def test_ca_0021_18_casos_reales_lado_a_lado(tmp_path, monkeypatch):
    from app import cli

    exam_case = {**REAL_CASE, "id": "ffff000011112222", "type": "EXAM"}
    rows = cli.run_real_cases(MockLLM(), [REAL_CASE, exam_case])
    assert rows[0]["complaints"] == REAL_CASE["complaints"]
    assert rows[0]["valid"] is True
    assert len(rows[0]["output"]["questions"]) == 4
    assert rows[0]["qualityWarnings"] == []
    assert "skipped" in rows[1]

    source = tmp_path / "cases.jsonl"
    source.write_text(json.dumps(REAL_CASE) + "\n", encoding="utf8")
    monkeypatch.setattr(cli, "REAL_DIR", tmp_path / "real")
    cli.cmd_benchmark_real(source, mock=True, pause_s=0)
    report = json.loads(next((tmp_path / "real").glob("report-*.json")).read_text("utf8"))
    assert report["qualityRulesVersion"] == QUALITY_RULES_VERSION
    assert report["rows"][0]["id"] == REAL_CASE["id"]
