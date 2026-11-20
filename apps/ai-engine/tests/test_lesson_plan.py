"""Plan de aula con evaluación y rúbrica (SPEC-0024)."""

import json

import pytest

from app.generation.lesson_plan import (
    LESSON_PLAN_PROMPT,
    LessonPlanRequest,
    build_lesson_plan_messages,
    generate_lesson_plan,
)
from app.generation.pipeline import GenerationInvalidError
from app.providers import MockLLM

from .test_resources import (
    CONTEXT,
    ScriptedLLM,
    data_block,
    mock_api,  # noqa: F401 (fixture)
)

REQUEST = {**CONTEXT, "sessions": 2, "minutesPerSession": 55}


def plan() -> dict:
    """Un plan válido: el del LLM de prueba."""
    messages = build_lesson_plan_messages(LessonPlanRequest(**REQUEST))
    return json.loads(MockLLM().generate(messages, json_mode=True, max_tokens=10).text)


def test_ca_0024_01_plan_valido_con_sesiones_rubrica_y_evaluacion():
    llm = ScriptedLLM(json.dumps(plan()))
    result = generate_lesson_plan(llm, LessonPlanRequest(**REQUEST))
    assert llm.calls[0][0].content == LESSON_PLAN_PROMPT
    data = data_block(llm.calls[0])
    assert data["cantidadSesiones"] == 2 and data["minutosPorSesion"] == 55
    out = result.value
    assert [s.number for s in out.sessions] == [1, 2]
    assert len(out.rubric) == 2 and out.evaluation.instruments
    assert result.attempts == 1


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda p: p["sessions"].pop(), "Se pidieron 2 sesiones y llegaron 1"),
        (lambda p: p["sessions"][0].update(developmentMinutes=5), "deben sumar 55"),
        (lambda p: p["rubric"][0].update(low=""), "descriptor de 10 a 300"),
        (
            lambda p: p["rubric"][0].update(low=p["rubric"][0]["basic"]),
            "los cuatro desempeños deben ser distintos",
        ),
        (lambda p: p["sessions"][1].update(dbaCodes=["INVENTADO"]), "INVENTADO"),
        (lambda p: p.update(rubric=p["rubric"][:1]), "de 2 a 5 criterios"),
    ],
)
def test_ca_0024_02_repara_con_el_error_concreto(change, message):
    bad = plan()
    change(bad)
    llm = ScriptedLLM(json.dumps(bad), json.dumps(plan()))
    generate_lesson_plan(llm, LessonPlanRequest(**REQUEST))
    assert message in llm.calls[1][-1].content


def test_ca_0024_02_falla_tras_tres_intentos(mock_api, auth):  # noqa: F811
    bad = plan()
    bad["sessions"].pop()
    with pytest.raises(GenerationInvalidError):
        generate_lesson_plan(ScriptedLLM(*[json.dumps(bad)] * 3), LessonPlanRequest(**REQUEST))
    response = mock_api.post("/v1/generation/lesson-plan", json=REQUEST, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["promptVersion"] == "lesson_plan.v1"
    assert len(body["plan"]["sessions"]) == 2
    extra = mock_api.post(
        "/v1/generation/lesson-plan", json={**REQUEST, "studentName": "Ana"}, headers=auth
    )
    assert extra.status_code == 422
