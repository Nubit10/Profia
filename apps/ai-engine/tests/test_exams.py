"""Exámenes por secciones y regeneración de una pregunta del examen (SPEC-0011)."""

import copy
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.main import create_app
from app.generation.exams import (
    ExamItemRequest,
    ExamRequest,
    generate_exam,
    plan_sections,
    regenerate_exam_item,
)
from app.generation.pipeline import GenerationInvalidError
from app.providers import LLMChain, MockLLM

from .test_resources import DBA, ScriptedLLM, data_block

TOPICS = [
    {"key": "T1", "title": "La recta numérica", "description": "Orden de enteros"},
    {"key": "T2", "title": "Suma de enteros", "description": None},
    {"key": "T3", "title": "Resta de enteros", "description": None},
]
EXAM = {
    "subject": "Matemáticas",
    "grade": "6°",
    "topics": TOPICS,
    "objectives": ["Compara números enteros usando la recta numérica."],
    "dba": DBA,
    "difficulty": "INTERMEDIATE",
    "durationMinutes": 90,
    "sections": [
        {"questionType": "MULTIPLE_CHOICE", "questionCount": 6, "pointsPerQuestion": 5},
        {"questionType": "MATCHING", "questionCount": 1, "pointsPerQuestion": 20},
        {"questionType": "TRUE_FALSE", "questionCount": 4, "pointsPerQuestion": 2.5},
        {"questionType": "OPEN", "questionCount": 2, "pointsPerQuestion": 10},
    ],
    "cognitiveDistribution": {"REMEMBER": 30, "UNDERSTAND": 30, "APPLY": 20, "ANALYZE": 20},
}


def mock_exam(request: ExamRequest):
    return generate_exam(MockLLM(), request)


def test_plan_reparte_temas_y_niveles_entre_las_secciones():
    request = ExamRequest(**EXAM)
    plans = plan_sections(request)
    assert [sum(p.levels.values()) for p in plans] == [6, 1, 4, 2]
    # Cada tema queda obligatorio en al menos una sección (RN-03).
    assert {t for p in plans for t in p.topics} == {"T1", "T2", "T3"}
    # Los niveles van de menor a mayor exigencia a lo largo del examen.
    assert "REMEMBER" in plans[0].levels and "ANALYZE" in plans[-1].levels


def test_ca_0011_02_examen_con_secciones_en_orden_cantidad_exacta_y_todos_los_temas():
    request = ExamRequest(**EXAM)
    result = mock_exam(request)
    sections = result.value.sections
    assert [s.questionType for s in sections] == [
        "MULTIPLE_CHOICE",
        "MATCHING",
        "TRUE_FALSE",
        "OPEN",
    ]
    assert [len(s.questions) for s in sections] == [6, 1, 4, 2]
    assert all(q.type == s.questionType for s in sections for q in s.questions)
    assert {q.topic for s in sections for q in s.questions} == {"T1", "T2", "T3"}
    allowed = {d["code"] for d in DBA}
    assert all(set(q.dbaCodes) <= allowed for s in sections for q in s.questions)
    # RN-10: una llamada por sección, con sus métricas.
    assert len(result.calls) == 4
    assert result.tokens == sum(c.tokens for c in result.calls)
    # RN-05: los criterios de la abierta suman sus puntos.
    for q in sections[3].questions:
        assert round(sum(c.points for c in q.criteria), 1) == 10
    # RN-04: emparejamiento entre 4 y 8 pares.
    assert 4 <= len(sections[1].questions[0].pairs) <= 8


def test_cada_seccion_recibe_lo_que_ya_se_pregunto_para_no_repetir():
    llm = MockLLM()
    seen: list[dict] = []
    original = llm.generate

    def spy(messages, **kwargs):
        seen.append(data_block(messages))
        return original(messages, **kwargs)

    llm.generate = spy  # type: ignore[method-assign]
    generate_exam(llm, ExamRequest(**EXAM))
    assert seen[0]["preguntasYaHechas"] == []
    assert len(seen[1]["preguntasYaHechas"]) == 6
    # El contexto viaja como datos y sin campos personales (RN-08).
    assert seen[0]["seccion"]["tipo"] == "MULTIPLE_CHOICE"
    assert "institucion" not in seen[0] and "docente" not in seen[0]


def section_json(questions: list[dict]) -> str:
    return json.dumps({"questions": questions})


def good_section(request: ExamRequest, index: int) -> list[dict]:
    """La salida del modelo de prueba para una sección, como dicts editables."""
    plan = plan_sections(request)[index]
    from app.generation.exams import build_section_messages

    messages = build_section_messages(request, plan, index, [])
    return json.loads(MockLLM().generate(messages, json_mode=True, max_tokens=1).text)["questions"]


def broken(request: ExamRequest, index: int, change) -> str:
    questions = copy.deepcopy(good_section(request, index))
    change(questions)
    return section_json(questions)


@pytest.mark.parametrize(
    ("index", "change", "expected"),
    [
        (0, lambda qs: qs.pop(), "debe tener 6 preguntas"),
        (0, lambda qs: qs[0].update(topic="T9"), "'topic' debe ser una de las claves"),
        (0, lambda qs: qs[0].update(dbaCodes=["MEN-DBA-INVENTADO"]), "cita DBA que no están"),
        (0, lambda qs: [q.update(topic="T1") for q in qs], "temas obligatorios"),
        (1, lambda qs: qs[0]["pairs"].append(dict(qs[0]["pairs"][0])), "repetidos en la columna A"),
        (1, lambda qs: qs[0].update(pairs=qs[0]["pairs"][:3]), "entre 4 y 8 pares"),
        (3, lambda qs: qs[0]["criteria"][0].update(points=1), "deben sumar 10"),
        (3, lambda qs: qs[0].update(criteria=[]), "entre 1 y 4 criterios"),
        (0, lambda qs: qs[0].update(type="OPEN"), "solo admite preguntas de tipo MULTIPLE_CHOICE"),
    ],
)
def test_ca_0011_03_el_validador_pide_reparacion_con_el_error_concreto(index, change, expected):
    request = ExamRequest(**EXAM)
    plan = plan_sections(request)[index]
    good = [section_json(good_section(request, i)) for i in range(index)]
    bad = broken(request, index, change)
    fixed = section_json(good_section(request, index))
    rest = [section_json(good_section(request, i)) for i in range(index + 1, 4)]
    llm = ScriptedLLM(*good, bad, fixed, *rest)
    result = generate_exam(llm, request)
    assert len(result.value.sections[index].questions) == plan.spec.questionCount
    repair = llm.calls[index + 1][-1].content
    assert expected in repair, repair


def test_ca_0011_03_tras_tres_intentos_invalidos_falla_todo_el_examen():
    request = ExamRequest(**EXAM)
    bad = broken(request, 0, lambda qs: qs.pop())
    with pytest.raises(GenerationInvalidError) as error:
        generate_exam(ScriptedLLM(bad, bad, bad), request)
    assert error.value.attempts == 3


def test_la_distribucion_cognitiva_del_examen_completo_queda_en_mas_o_menos_uno():
    request = ExamRequest(**EXAM)
    result = mock_exam(request)
    levels = [q.cognitiveLevel for s in result.value.sections for q in s.questions]
    from app.generation.resources import target_counts

    for level, expected in target_counts(request.cognitiveDistribution, len(levels)).items():
        assert abs(levels.count(level) - expected) <= 1


@pytest.mark.parametrize(
    "change",
    [
        lambda e: e.update(sections=e["sections"][:1]),
        lambda e: e["sections"][0].update(questionCount=21),
        lambda e: e["sections"][1].update(questionCount=3),
        lambda e: e["sections"][0].update(pointsPerQuestion=1.25),
        lambda e: e.update(topics=[*TOPICS, {**TOPICS[0]}]),
        lambda e: e.update(sections=[{**s, "questionCount": 1} for s in e["sections"]]),
        lambda e: e.update(durationMinutes=20),
    ],
)
def test_peticiones_de_examen_invalidas(change):
    body = copy.deepcopy(EXAM)
    change(body)
    with pytest.raises(ValidationError):
        ExamRequest(**body)


def exam_item_request(question: dict, points: float, instruction="Hazla más difícil") -> dict:
    return {
        **{k: EXAM[k] for k in ("subject", "grade", "topics", "objectives", "dba", "difficulty")},
        "current": question,
        "points": points,
        "instruction": instruction,
        "otherItems": [],
    }


def test_ca_0011_06_regenerar_un_emparejamiento_o_una_abierta_da_el_mismo_tipo():
    request = ExamRequest(**EXAM)
    matching = good_section(request, 1)[0]
    open_question = good_section(request, 3)[0]
    for question, points in [(matching, 20), (open_question, 10)]:
        result = regenerate_exam_item(
            MockLLM(), ExamItemRequest(**exam_item_request(question, points))
        )
        item = result.value.item
        assert item.type == question["type"]
        assert item.stem != question["stem"]
        if item.type == "OPEN":
            assert round(sum(c.points for c in item.criteria), 1) == points


@pytest.fixture
def mock_api(settings, indexed) -> TestClient:
    client, provider, _ = indexed
    llm = LLMChain([MockLLM()])
    return TestClient(create_app(settings=settings, provider=provider, client=client, llm=llm))


def test_endpoint_de_examen_con_el_llm_de_prueba(mock_api, auth):
    response = mock_api.post("/v1/generation/exam", json=EXAM, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert [len(s["questions"]) for s in body["exam"]["sections"]] == [6, 1, 4, 2]
    assert body["meta"]["promptVersion"] == "exam.v1"
    assert [c["section"] for c in body["meta"]["calls"]] == [1, 2, 3, 4]
    assert body["meta"]["tokens"] == sum(c["tokens"] for c in body["meta"]["calls"])

    question = body["exam"]["sections"][3]["questions"][0]
    item = mock_api.post(
        "/v1/generation/exam/item", json=exam_item_request(question, 10), headers=auth
    )
    assert item.status_code == 200, item.text
    assert item.json()["meta"]["promptVersion"] == "exam_item.v1"


def test_ca_0011_10_el_contrato_rechaza_campos_de_mas_y_exige_token(mock_api, auth):
    for extra in [{"institution": "Colegio San José"}, {"teacherName": "Ana"}]:
        response = mock_api.post("/v1/generation/exam", json={**EXAM, **extra}, headers=auth)
        assert response.status_code == 422
    topic = {**TOPICS[0], "email": "ana@colegio.edu.co"}
    body = {**EXAM, "topics": [topic, *TOPICS[1:]]}
    assert mock_api.post("/v1/generation/exam", json=body, headers=auth).status_code == 422
    assert mock_api.post("/v1/generation/exam", json=EXAM).status_code == 401


def test_ca_0011_03_salida_invalida_del_examen_responde_502(settings, indexed, auth):
    client, provider, _ = indexed
    request = ExamRequest(**EXAM)
    bad = broken(request, 0, lambda qs: qs.pop())
    llm = LLMChain([ScriptedLLM(bad, bad, bad)])
    api = TestClient(create_app(settings=settings, provider=provider, client=client, llm=llm))
    assert api.post("/v1/generation/exam", json=EXAM, headers=auth).status_code == 502


def test_preguntas_de_mas_se_recortan_sin_gastar_otro_intento():
    """Benchmark CA-0011-14: una sección de 20 llegó con 22 preguntas en los tres intentos."""
    request = ExamRequest(**EXAM)
    questions = good_section(request, 0)
    extra = [{**questions[0], "stem": f"Pregunta extra {i}: ¿cuál es mayor?"} for i in range(2)]
    rest = [section_json(good_section(request, i)) for i in range(1, 4)]
    llm = ScriptedLLM(section_json([*extra, *questions]), *rest)
    result = generate_exam(llm, request)
    first = result.value.sections[0].questions
    assert len(first) == 6
    assert result.calls[0].attempts == 1
