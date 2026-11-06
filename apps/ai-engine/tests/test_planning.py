"""SPEC-0014: propuesta de planeación (contrato generation-planning.v1, ADR-0013)."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.main import create_app
from app.generation.pipeline import GenerationInvalidError
from app.generation.planning import PlanningRequest, propose_planning
from app.providers import LLMChain, MockLLM
from app.providers.mock_llm import INVENTED_CODE
from tests.test_resources import ScriptedLLM, data_block

CODES = [f"MEN-DBA-MAT-V2-G6-{i:02d}" for i in range(1, 7)]
DBA = [{"code": c, "statement": f"Enunciado del DBA {c[-2:]}.", "evidences": []} for c in CODES]


def period(number: int, codes: list[str], existing=None) -> dict:
    return {
        "number": number,
        "name": f"Periodo {number}",
        "dbaCodes": codes,
        "mustCover": codes,
        "existing": existing or [],
    }


def request(**extra) -> dict:
    return {
        "subject": "Matemáticas",
        "grade": "6°",
        "dba": DBA,
        "periods": [period(1, CODES[:3])],
        **extra,
    }


def out(*units: tuple[str, list[tuple[str, list[str]]]]) -> str:
    return json.dumps(
        {
            "units": [
                {
                    "title": title,
                    "topics": [
                        {
                            "title": t,
                            "description": f"Se trabaja {t.lower()} en clase.",
                            "dbaCodes": c,
                        }
                        for t, c in topics
                    ],
                }
                for title, topics in units
            ]
        },
        ensure_ascii=False,
    )


GOOD = out(
    ("Números enteros", [("La recta numérica", [CODES[0]]), ("Orden de enteros", [CODES[1]])]),
    ("Fracciones", [("Fracciones equivalentes", [CODES[2]]), ("Suma de fracciones", [CODES[2]])]),
)


def test_ca_0014_02_quita_codigos_ajenos_al_periodo_sin_pedir_reparacion():
    bad = out(
        (
            "Números enteros",
            [("La recta numérica", [CODES[0], "MEN-DBA-FALSO"]), ("Orden", [CODES[1], CODES[5]])],
        ),
        ("Fracciones", [("Fracciones equivalentes", [CODES[2]]), ("Suma", [CODES[2]])]),
    )
    llm = ScriptedLLM(bad)
    result = propose_planning(llm, PlanningRequest(**request()))
    assert result.attempts == 1
    assert result.dropped_codes == 2  # el inventado y el de otro periodo
    codes = {c for u in result.periods[0].units for t in u.topics for c in t.dbaCodes}
    assert codes == set(CODES[:3])
    # El modelo recibe solo los DBA del periodo, como datos delimitados.
    sent = data_block(llm.calls[0])
    assert [d["codigo"] for d in sent["dba"]] == CODES[:3]


def test_ca_0014_04_no_repite_lo_existente_y_repara():
    existing = [{"title": "Números enteros", "topics": ["La recta numérica"]}]
    req = request(periods=[period(1, CODES[:3], existing)])
    llm = ScriptedLLM(GOOD, GOOD.replace("Números enteros", "Enteros").replace(
        "La recta numérica", "Valor absoluto"))  # fmt: skip
    result = propose_planning(llm, PlanningRequest(**req))
    assert result.attempts == 2
    assert "repite un título que ya existe" in llm.calls[1][-1].content
    titles = [u.title for u in result.periods[0].units]
    assert titles == ["Enteros", "Fracciones"]


def test_ca_0014_05_cada_dba_del_periodo_queda_en_un_tema():
    missing = out(
        ("Números enteros", [("La recta numérica", [CODES[0]]), ("Orden de enteros", [CODES[0]])]),
        ("Fracciones", [("Equivalentes", [CODES[1]]), ("Suma de fracciones", [CODES[1]])]),
    )
    llm = ScriptedLLM(missing, missing, missing)
    with pytest.raises(GenerationInvalidError) as error:
        propose_planning(llm, PlanningRequest(**request()))
    assert any(CODES[2] in e for e in error.value.errors)


def test_rn_05_respeta_las_cantidades_y_el_largo_de_los_titulos():
    long_title = "x" * 81
    bad = out(("Números enteros", [(long_title, [CODES[0]])]))
    llm = ScriptedLLM(bad, GOOD)
    result = propose_planning(llm, PlanningRequest(**request()))
    errors = llm.calls[1][-1].content
    assert "unidades" in errors and "temas" in errors and "80 caracteres" in errors
    assert len(result.periods[0].units) == 2


def test_el_año_es_una_llamada_por_periodo_y_no_repite_titulos_entre_periodos():
    llm = LLMChain([MockLLM()])
    req = request(periods=[period(1, CODES[:3]), period(2, CODES[3:])])
    result = propose_planning(llm, PlanningRequest(**req))
    assert [p.number for p in result.periods] == [1, 2]
    titles = [t.title for p in result.periods for u in p.units for t in u.topics]
    assert len(titles) == len(set(titles))
    covered = {c for p in result.periods for u in p.units for t in u.topics for c in t.dbaCodes}
    assert covered == set(CODES)
    assert INVENTED_CODE not in covered
    assert result.dropped_codes == 2  # el mock inventa uno por periodo


def test_ca_0014_06_temas_para_una_unidad_existente():
    unit = {"title": "Números enteros", "description": None, "topics": ["La recta numérica"]}
    req = request(unit=unit, topicsMin=2, topicsMax=4)
    result = propose_planning(LLMChain([MockLLM()]), PlanningRequest(**req))
    [only] = result.periods[0].units
    assert only.title == "Números enteros"
    assert 2 <= len(only.topics) <= 4
    assert "La recta numérica" not in [t.title for t in only.topics]


def test_otra_propuesta_evita_los_titulos_de_la_revision():
    llm = ScriptedLLM(GOOD, GOOD.replace("Números enteros", "Enteros"))
    result = propose_planning(llm, PlanningRequest(**request(avoid=["Números enteros"])))
    assert data_block(llm.calls[0])["titulosUsados"] == ["Números enteros"]
    assert result.attempts == 2
    assert result.periods[0].units[0].title == "Enteros"


def test_la_peticion_no_admite_campos_de_mas_ni_dba_ajenos():
    with pytest.raises(ValidationError):
        PlanningRequest(**request(teacherName="Ana"))
    with pytest.raises(ValidationError):
        PlanningRequest(**request(periods=[period(1, ["MEN-DBA-OTRO"])]))
    with pytest.raises(ValidationError):
        PlanningRequest(**request(unitsMin=4, unitsMax=2))


@pytest.fixture
def mock_api(settings, indexed) -> TestClient:
    client, provider, _ = indexed
    llm = LLMChain([MockLLM()])
    return TestClient(create_app(settings=settings, provider=provider, client=client, llm=llm))


def test_endpoint_de_planeacion(mock_api, auth):
    response = mock_api.post("/v1/generation/planning", json=request(), headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["promptVersion"] == "planning.v1"
    assert body["meta"]["droppedCodes"] == 1
    assert len(body["periods"][0]["units"]) >= 2
    assert mock_api.post("/v1/generation/planning", json=request()).status_code == 401
