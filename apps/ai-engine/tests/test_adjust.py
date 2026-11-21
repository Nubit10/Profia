"""Ajustes rápidos con botones (SPEC-0027): código fijo y versión actual, sin texto libre."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.main import create_app
from app.generation.adjust import ADJUST_PROMPT_VERSION
from app.generation.exams import ExamRequest, build_section_messages, plan_sections
from app.generation.lesson_plan import LessonPlanRequest, build_lesson_plan_messages
from app.generation.resources import (
    ItemRequest,
    QuizRequest,
    WorkshopRequest,
    build_item_messages,
    build_quiz_messages,
    build_workshop_messages,
)
from app.providers import LLMChain, MockLLM

from .test_exams import EXAM
from .test_lesson_plan import REQUEST as LESSON_PLAN
from .test_resources import GOOD_QUIZ, ITEM, QUIZ, WORKSHOP, data_block

CURRENT = {"title": "Quiz de enteros", "questions": GOOD_QUIZ}


def test_ca_0027_09_quiz_ajustado_lleva_codigo_y_version_actual_como_datos():
    messages = build_quiz_messages(
        QuizRequest(**QUIZ, adjust={"code": "EASIER", "current": CURRENT})
    )
    data = data_block(messages)
    assert data["ajuste"] == {"codigo": "EASIER", "versionActual": CURRENT}
    assert "AJ-2" in messages[0].content
    assert "Aplica el ajuste EASIER" in messages[1].content


def test_sin_ajuste_el_prompt_no_cambia():
    messages = build_quiz_messages(QuizRequest(**QUIZ))
    assert "ajuste" not in data_block(messages)
    assert "AJ-2" not in messages[0].content


def test_taller_y_plan_de_aula_aceptan_el_ajuste():
    workshop = build_workshop_messages(
        WorkshopRequest(**WORKSHOP, adjust={"code": "EVERYDAY_EXAMPLES", "current": {"t": 1}})
    )
    assert data_block(workshop)["ajuste"]["codigo"] == "EVERYDAY_EXAMPLES"
    plan = build_lesson_plan_messages(
        LessonPlanRequest(**LESSON_PLAN, adjust={"code": "SHORTER", "current": None})
    )
    assert data_block(plan)["ajuste"] == {"codigo": "SHORTER", "versionActual": None}


def test_ca_0027_04_examen_solo_admite_ajustes_que_no_cambian_puntos():
    for code in ("SHORTER", "ADD_ITEMS"):
        with pytest.raises(ValidationError):
            ExamRequest(**EXAM, adjust={"code": code})
    current = {"sections": [{"questions": [{"stem": "A"}]}, {"questions": [{"stem": "B"}]}]}
    request = ExamRequest(**EXAM, adjust={"code": "HARDER", "current": current})
    plans = plan_sections(request)
    second = data_block(build_section_messages(request, plans[1], 1, []))
    assert second["ajuste"]["versionActual"] == {"questions": [{"stem": "B"}]}


def test_ca_0027_08_item_con_codigo_sin_indicacion_escrita():
    body = {**ITEM, "instruction": None, "adjust": "ANOTHER"}
    data = data_block(build_item_messages(ItemRequest(**body)))
    assert data["ajuste"] == {"codigo": "ANOTHER"}
    assert data["indicacionDelDocente"] is None
    with pytest.raises(ValidationError):
        ItemRequest(**{**ITEM, "instruction": None})
    with pytest.raises(ValidationError):
        ItemRequest(**{**ITEM, "adjust": "HARDER"})  # no es un ajuste de ítem


def test_codigos_desconocidos_y_versiones_enormes_se_rechazan():
    with pytest.raises(ValidationError):
        QuizRequest(**QUIZ, adjust={"code": "HAZLO_EN_INGLES"})
    with pytest.raises(ValidationError):
        QuizRequest(**QUIZ, adjust={"code": "EASIER", "current": {"x": "a" * 50_000}})
    with pytest.raises(ValidationError):
        QuizRequest(**QUIZ, adjust={"code": "EASIER", "texto": "libre"})


@pytest.fixture
def mock_api(settings, indexed) -> TestClient:
    client, provider, _ = indexed
    return TestClient(
        create_app(settings=settings, provider=provider, client=client, llm=LLMChain([MockLLM()]))
    )


def test_ca_0027_09_la_version_registrada_incluye_el_anexo(mock_api, auth):
    body = {**QUIZ, "adjust": {"code": "HARDER", "current": CURRENT}}
    response = mock_api.post("/v1/generation/quiz", json=body, headers=auth)
    assert response.status_code == 200, response.text
    assert response.json()["meta"]["promptVersion"].endswith(f"+{ADJUST_PROMPT_VERSION}")
    item = mock_api.post(
        "/v1/generation/item",
        json={**ITEM, "instruction": None, "adjust": "CLEARER"},
        headers=auth,
    )
    assert item.status_code == 200, item.text
    assert item.json()["meta"]["promptVersion"].endswith(f"+{ADJUST_PROMPT_VERSION}")
    assert json.dumps(body)  # el cuerpo es JSON plano
