"""Preguntas tipo Saber con situación, figura y competencia (SPEC-0023)."""

import pytest
from pydantic import ValidationError

from app.generation.exams import ExamRequest, generate_exam
from app.generation.resources import (
    MATH_CHECK_PROMPT,
    QUIZ_PROMPT,
    SABER_PROMPT,
    QuizRequest,
    generate_quiz,
    quiz_prompt_version,
)
from app.generation.saber import competencies, saber_area
from app.providers import MockLLM
from tests.test_exams import EXAM
from tests.test_resources import QUIZ, ScriptedLLM, data_block, quiz_out

CODE = "MEN-DBA-MAT-V2-G6-01"
MATH = competencies()["MATEMATICAS"]
SABER_QUIZ = {
    **QUIZ,
    "questionTypes": ["MULTIPLE_CHOICE"],
    "cognitiveDistribution": {"APPLY": 100},
    "saber": True,
}
CONTEXT = (
    "En una tienda de Sincelejo anotan cada día cuántas arepas venden. El lunes venden doce, el "
    "martes ocho y el miércoles quince."
)


def q(i: int, competency: str | None = None, figure: dict | None = None, context=CONTEXT) -> dict:
    value = i + 5
    return {
        "type": "MULTIPLE_CHOICE",
        "stem": f"¿Cuántas arepas hay si se suman {i} y 5?",
        "options": [str(value), str(value + 1), str(value - 2), str(value + 3)],
        "answer": str(value),
        "explanation": "Se suman las cantidades anotadas en el cuaderno.",
        "cognitiveLevel": "APPLY",
        "dbaCodes": [CODE],
        "check": {"expression": f"{i} + 5"},
        "context": context,
        "competency": competency if competency is not None else MATH[i % len(MATH)],
        **({"figure": figure} if figure else {}),
    }


LINE = {
    "kind": "NUMBER_LINE",
    "min": -5,
    "max": 5,
    "step": 1,
    "marks": [{"value": -3, "label": "A"}],
}


def test_ca_0023_01_quiz_saber_con_anexo_version_y_competencias():
    questions = [q(0, figure=LINE), q(1), q(2), q(3)]
    llm = ScriptedLLM(quiz_out(questions))
    request = QuizRequest(**SABER_QUIZ)
    result = generate_quiz(llm, request)
    assert llm.calls[0][0].content == f"{QUIZ_PROMPT}\n{MATH_CHECK_PROMPT}\n{SABER_PROMPT}"
    data = data_block(llm.calls[0])
    assert data["estiloSaber"] is True and data["competencias"] == MATH
    assert quiz_prompt_version(request) == "quiz.v1+math_check.v1+saber.v1"
    out = result.value.questions
    assert all(x.context == CONTEXT and x.competency in MATH for x in out)
    assert out[0].figure.kind == "NUMBER_LINE"
    assert all(x.answerCheck.status == "VERIFIED" for x in out)


@pytest.mark.parametrize(
    ("bad", "message"),
    [
        ({"context": "Muy corta."}, "'context' debe tener entre 15 y 150 palabras"),
        ({"competency": "Pensamiento crítico"}, "'competency' debe ser exactamente una de"),
        ({"figure": {**LINE, "marks": [{"value": 9, "label": "A"}]}}, "fuera de la recta"),
        (
            {"figure": {"kind": "TABLE", "headers": ["Día", "Ventas"], "rows": [["Lunes"]]}},
            "deben tener 2 celdas",
        ),
        (
            {
                "figure": {
                    "kind": "BAR_CHART",
                    "categories": ["a", "b", "c"],
                    "values": [1, 2],
                    "unit": "",
                }
            },
            "cada categoría necesita su valor",
        ),
        (
            {"figure": {"kind": "FRACTION", "numerator": 5, "denominator": 4, "shape": "BAR"}},
            "la fracción va de 0/d a d/d",
        ),
    ],
)
def test_ca_0023_02_la_reparacion_recibe_el_error_concreto(bad, message):
    first = {**q(0), **bad}
    good = [q(0), q(1), q(2), q(3)]
    llm = ScriptedLLM(quiz_out([first, q(1), q(2), q(3)]), quiz_out(good))
    result = generate_quiz(llm, QuizRequest(**SABER_QUIZ))
    assert message in llm.calls[1][-1].content
    assert result.attempts == 2


def test_ca_0023_03_varia_las_competencias():
    same = [q(i, competency=MATH[0]) for i in range(4)]
    llm = ScriptedLLM(quiz_out(same), quiz_out([q(i) for i in range(4)]))
    generate_quiz(llm, QuizRequest(**SABER_QUIZ))
    assert "al menos 2 competencias distintas" in llm.calls[1][-1].content


def test_ca_0023_04_lenguaje_sin_figuras_y_ciencias_no_aplica():
    lenguaje = {**SABER_QUIZ, "subject": "Lenguaje", "dba": [], "objectives": []}
    lang = competencies()["LENGUAJE"]
    text = " ".join(["palabra"] * 40) + "."
    questions = [
        {
            **q(i, competency=lang[i % 3], context=text),
            "dbaCodes": [],
            "check": None,
            "options": [f"Idea {i}{x}" for x in "abcd"],
            "answer": f"Idea {i}a",
        }
        for i in range(4)
    ]
    with_figure = [{**questions[0], "figure": LINE}, *questions[1:]]
    llm = ScriptedLLM(quiz_out(with_figure), quiz_out(questions))
    result = generate_quiz(llm, QuizRequest(**lenguaje))
    assert "en Lenguaje no van figuras" in llm.calls[1][-1].content
    assert all(x.figure is None and x.answerCheck is None for x in result.value.questions)
    with pytest.raises(ValidationError):
        QuizRequest(**{**SABER_QUIZ, "subject": "Ciencias Naturales"})
    assert saber_area("Lengua Castellana") == "LENGUAJE"
    assert saber_area("Ciencias Sociales") is None


def test_sin_estilo_saber_no_quedan_situacion_ni_figura():
    plain = {**SABER_QUIZ, "saber": False}
    llm = ScriptedLLM(quiz_out([q(0, figure=LINE), q(1), q(2), q(3)]))
    result = generate_quiz(llm, QuizRequest(**plain))
    assert SABER_PROMPT not in llm.calls[0][0].content
    assert all(
        x.context is None and x.figure is None and x.competency is None
        for x in result.value.questions
    )


def test_examen_saber_solo_en_seleccion_multiple(api, auth):
    exam = generate_exam(MockLLM(), ExamRequest(**{**EXAM, "saber": True}))
    for section in exam.value.sections:
        for x in section.questions:
            if section.questionType == "MULTIPLE_CHOICE":
                assert x.context and x.competency in MATH
            else:
                assert x.context is None and x.figure is None
    figures = [x.figure for s in exam.value.sections for x in s.questions if x.figure]
    assert figures and figures[0].kind == "NUMBER_LINE"
    response = api.post("/v1/generation/exam", json={**EXAM, "saber": True}, headers=auth)
    assert response.status_code == 200, response.text
    assert response.json()["meta"]["promptVersion"] == "exam.v1+math_check.v1+saber.v1"
    quiz = api.post("/v1/generation/quiz", json=SABER_QUIZ, headers=auth).json()
    assert quiz["meta"]["promptVersion"] == "quiz.v1+math_check.v1+saber.v1"
    assert quiz["quiz"]["questions"][0]["figure"]["kind"] == "NUMBER_LINE"
    # El cálculo del modelo no sale del motor (SPEC-0022 RN-07).
    assert all(x.get("check") is None for x in quiz["quiz"]["questions"])
