"""Verificación de las respuestas de Matemáticas (SPEC-0022)."""

import json
from fractions import Fraction

import pytest

from app.generation.exams import (
    ExamItemRequest,
    ExamRequest,
    generate_exam,
    regenerate_exam_item,
)
from app.generation.mathcheck import (
    CheckError,
    MathCheck,
    evaluate,
    matches,
    parse_number,
    show,
    solve_linear,
)
from app.generation.resources import (
    MATH_CHECK_PROMPT,
    QUIZ_PROMPT,
    ItemRequest,
    QuizRequest,
    generate_quiz,
    regenerate_item,
)
from app.providers import MockLLM
from tests.test_exams import EXAM
from tests.test_resources import CONTEXT, QUIZ, ScriptedLLM, quiz_out

CODE = "MEN-DBA-MAT-V2-G6-01"
MC_QUIZ = {
    **QUIZ,
    "questionTypes": ["MULTIPLE_CHOICE", "SHORT_ANSWER"],
    "cognitiveDistribution": {"APPLY": 100},
}


def q(stem: str, options: list[str], answer: str, check: dict | None, kind="MULTIPLE_CHOICE"):
    return {
        "type": kind,
        "stem": stem,
        "options": options,
        "answer": answer,
        "explanation": "Se resuelve paso a paso en la recta numérica.",
        "cognitiveLevel": "APPLY",
        "dbaCodes": [CODE],
        **({"check": check} if check is not None else {}),
    }


def good(i: int) -> dict:
    """Pregunta verificable distinta por índice: (i) + 5."""
    value = i + 5
    options = [str(value), str(value + 1), str(value - 2), str(value + 3)]
    return q(f"¿Cuánto es {i} + 5 en la recta?", options, str(value), {"expression": f"{i} + 5"})


# --- Evaluador --------------------------------------------------------------------------------


def test_ca_0022_01_evalua_exacto():
    assert evaluate("(-3) + 5") == 2
    assert evaluate("1/3 + 1/6") == Fraction(1, 2)
    assert evaluate("0,5 * 4") == 2
    assert evaluate("25% * 80") == 20
    assert evaluate("2^3 - 3**2") == -1
    assert evaluate("sqrt(49) + sqrt(9/4)") == Fraction(17, 2)
    assert evaluate("−3 × 4 ÷ 2") == -6
    assert evaluate("2(3+1)") == 8
    assert evaluate("0.1 + 0.2") == Fraction(3, 10)


@pytest.mark.parametrize(
    "text",
    [
        "__import__('os').system('echo hola')",
        "open('/etc/passwd')",
        "(1).__class__",
        "[1, 2][0]",
        "'texto'",
        "1/0",
        "2**99",
        "10**20",
        "sqrt(2)",
        "sqrt(-4)",
        "x + 1",
        "lambda: 1",
        "1 if 1 else 2",
        "9" * 130,
    ],
)
def test_ca_0022_01_rechaza_sin_ejecutar(text):
    with pytest.raises(CheckError):
        evaluate(text)


def test_ca_0022_02_ecuacion_lineal():
    assert solve_linear("2*x + 3 = 11", "x") == 4
    assert solve_linear("x/2 - 1 = 3", "x") == 8
    assert solve_linear("3(y - 2) = y + 4", "y") == 5
    for bad, var in [("x^2 = 4", "x"), ("x = x + 1", "x"), ("2*x = 4 = 4", "x"), ("2*x = 4", "xx")]:
        with pytest.raises(CheckError):
            solve_linear(bad, var)


def test_lee_numeros_como_en_colombia():
    assert parse_number("−3 °C").value == -3
    assert parse_number("x = 4").value == 4
    assert parse_number("$ 2.500").value == 2500
    assert parse_number("0,5").value == Fraction(1, 2)
    assert parse_number("2/3").value == Fraction(2, 3)
    assert parse_number("25 %").percent
    assert parse_number("Un triángulo") is None
    assert parse_number("Opción A de la pregunta 1") is None
    assert matches(Fraction(1, 3), "0,33")
    assert matches(Fraction(1, 4), "25 %")
    assert not matches(Fraction(1, 3), "0,3")
    assert show(Fraction(5, 2)) == "2,5"
    assert show(Fraction(1, 3)) == "1/3"
    assert show(Fraction(-7)) == "-7"


# --- Quiz ------------------------------------------------------------------------------------


def test_ca_0022_03_respuesta_verificada_y_sin_check():
    questions = [good(i) for i in range(4)]
    llm = ScriptedLLM(quiz_out(questions))
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert llm.calls[0][0].content == f"{QUIZ_PROMPT}\n{MATH_CHECK_PROMPT}"
    for out in result.value.questions:
        assert out.check is None
        assert out.answerCheck.status == "VERIFIED"
    assert result.value.questions[0].answerCheck.note == "El cálculo da 5."
    assert result.warnings == ()


def test_ca_0022_04_repara_y_si_persiste_corrige_con_la_unica_opcion():
    wrong = [good(i) for i in range(4)]
    wrong[1] = {**wrong[1], "answer": wrong[1]["options"][1]}  # 7 en vez de 6
    llm = ScriptedLLM(quiz_out(wrong), quiz_out(wrong), quiz_out(wrong))
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert "el cálculo da 6 y la respuesta dice «7»" in llm.calls[1][-1].content
    fixed = next(x for x in result.value.questions if x.stem.startswith("¿Cuánto es 1 + 5"))
    assert fixed.answer == "6"
    assert fixed.answerCheck.status == "CORRECTED"
    assert any("corregida" in w for w in result.warnings)


def test_ca_0022_05_respuesta_corta_que_no_coincide_queda_por_revisar():
    short = q("¿Cuánto es 2 x 3?", [], "5", {"expression": "2*3"}, kind="SHORT_ANSWER")
    questions = [good(0), good(1), good(2), short]
    llm = ScriptedLLM(*[quiz_out(questions)] * 3)
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    out = result.value.questions[3]
    assert out.answer == "5"
    assert out.answerCheck.status == "REVIEW"
    assert "El cálculo da 6" in out.answerCheck.note
    assert any("por revisar" in w for w in result.warnings)


def test_ca_0022_06_dos_opciones_correctas():
    double = q("¿Cuánto es la mitad de 1?", ["1/2", "0,5", "2", "1"], "1/2", {"expression": "1/2"})
    questions = [double, good(1), good(2), good(3)]
    llm = ScriptedLLM(*[quiz_out(questions)] * 3)
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert "dos opciones son correctas" in llm.calls[1][-1].content
    out = next(x for x in result.value.questions if x.stem.startswith("¿Cuánto es la mitad"))
    assert out.answerCheck.status == "REVIEW"
    assert out.answer == "1/2"


def test_ca_0022_07_pide_el_calculo_y_si_no_llega_queda_por_revisar():
    missing = [good(i) for i in range(4)]
    missing[0] = {k: v for k, v in missing[0].items() if k != "check"}
    llm = ScriptedLLM(*[quiz_out(missing)] * 3)
    result = generate_quiz(llm, QuizRequest(**MC_QUIZ))
    assert "agrega 'check'" in llm.calls[1][-1].content
    out = next(x for x in result.value.questions if x.stem.startswith("¿Cuánto es 0 + 5"))
    assert out.answerCheck.status == "REVIEW"
    assert "No trae el cálculo" in out.answerCheck.note
    # Un cálculo malicioso no se ejecuta: queda por revisar.
    evil = [good(i) for i in range(4)]
    evil[0] = {**evil[0], "check": {"expression": "__import__('os').getcwd()"}}
    result = generate_quiz(ScriptedLLM(*[quiz_out(evil)] * 3), QuizRequest(**MC_QUIZ))
    out = next(x for x in result.value.questions if x.stem.startswith("¿Cuánto es 0 + 5"))
    assert out.answerCheck.status == "REVIEW"


def test_ca_0022_08_fuera_de_matematicas_no_se_pide_ni_se_marca():
    lenguaje = {**MC_QUIZ, "subject": "Lenguaje", "dba": [], "objectives": []}
    questions = [{**good(i), "dbaCodes": []} for i in range(4)]
    llm = ScriptedLLM(quiz_out(questions))
    result = generate_quiz(llm, QuizRequest(**lenguaje))
    assert llm.calls[0][0].content == QUIZ_PROMPT
    assert all(x.answerCheck is None and x.check is None for x in result.value.questions)
    assert MathCheck(expression="1") is not None


# --- Examen e ítems --------------------------------------------------------------------------


def test_ca_0022_09_examen_y_regeneracion_traen_la_verificacion(api, auth):
    exam = generate_exam(MockLLM(), ExamRequest(**EXAM))
    # El mock no tiene respuestas numéricas: nada que verificar, nada que marcar.
    for section in exam.value.sections:
        assert all(x.check is None for x in section.questions)

    item = ItemRequest(
        **CONTEXT,
        kind="QUIZ_QUESTION",
        current=good(1),
        instruction="Usa números más grandes",
        durationMinutes=30,
        questionTypes=["MULTIPLE_CHOICE"],
        otherItems=[],
    )
    new = {**good(40), "stem": "¿Cuánto es 40 + 5 en la recta numérica?"}
    result = regenerate_item(ScriptedLLM(json.dumps({"item": new})), item)
    assert result.value.item.answerCheck.status == "VERIFIED"
    assert result.value.item.check is None

    exam_item = ExamItemRequest(
        subject="Matemáticas",
        grade="6°",
        topics=[{"key": "T1", "title": "La recta numérica", "description": None}],
        dba=[{"code": CODE, "statement": "Interpreta los números enteros.", "evidences": []}],
        current={**good(2), "topic": "T1"},
        points=5,
        instruction="Cambia los números",
        otherItems=[],
    )
    bad = {**good(7), "topic": "T1", "answer": "13"}  # 12 es la correcta
    llm = ScriptedLLM(*[json.dumps({"item": bad})] * 3)
    out = regenerate_exam_item(llm, exam_item).value.item
    assert out.answer == "12"
    assert out.answerCheck.status == "CORRECTED"

    body = {**MC_QUIZ, "itemCount": 4}
    response = api.post("/v1/generation/quiz", json=body, headers=auth)
    assert response.json()["meta"]["promptVersion"] == "quiz.v1+math_check.v1"
