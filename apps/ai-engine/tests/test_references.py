"""SPEC-0039: Estándares y Orientaciones del MEN al generar (anexo referentes.v1)."""

import json

from app.generation.objectives import ObjectiveRequest
from app.generation.objectives import build_messages as objective_messages
from app.generation.planning import PlanningRequest, build_messages
from app.generation.references import REFERENCES_ANNEX, with_references_version
from app.providers.llm import DATA_END, DATA_START
from tests.test_planning import mock_api, period, request  # noqa: F401 (fixture)

STD = [
    {
        "code": f"MEN-EBC-CIU-V1-G6A7-{i:02d}",
        "statement": f"Estándar {i}.",
        "evidences": ["Estándar general del grupo."],
        "kind": "STANDARD",
    }
    for i in range(1, 4)
]


def data_of(messages) -> dict:
    user = messages[1].content
    return json.loads(user.split(DATA_START)[1].split(DATA_END)[0])


def test_ca_0039_08_estandares_viajan_con_tipo_y_anexo():
    req = PlanningRequest(**request(dba=STD, periods=[period(1, [s["code"] for s in STD])]))
    messages = build_messages(req, req.periods[0], [])
    assert REFERENCES_ANNEX in messages[0].content
    assert {d["tipo"] for d in data_of(messages)["dba"]} == {"Estándar"}
    assert with_references_version("planning.v1", req.dba) == "planning.v1+referentes.v1"


def test_ca_0039_08_solo_dba_queda_igual_que_antes():
    req = PlanningRequest(**request())
    messages = build_messages(req, req.periods[0], [])
    assert REFERENCES_ANNEX not in messages[0].content
    assert all("tipo" not in d for d in data_of(messages)["dba"])
    assert with_references_version("planning.v1", req.dba) == "planning.v1"


def test_ca_0039_08_orientacion_en_objetivos():
    req = ObjectiveRequest(
        subject="Tecnología e Informática",
        grade="6°",
        topic={"title": "Artefactos", "description": None},
        existingObjectives=[],
        dba=[
            {
                "code": "MEN-ORI-TEC-V1-G6A7-01",
                "statement": "Analizo la evolución de artefactos.",
                "evidences": ["Reconozco principios y conceptos propios de la tecnología."],
                "kind": "ORIENTATION",
            }
        ],
        count=2,
    )
    messages = objective_messages(req)
    assert REFERENCES_ANNEX in messages[0].content
    assert data_of(messages)["dba"][0]["tipo"] == "Orientación del MEN"


def test_ca_0039_08_endpoint_registra_la_version_con_el_anexo(mock_api, auth):  # noqa: F811
    body = request(dba=STD, periods=[period(1, [s["code"] for s in STD])])
    response = mock_api.post("/v1/generation/planning", json=body, headers=auth)
    assert response.status_code == 200, response.text
    assert response.json()["meta"]["promptVersion"] == "planning.v1+referentes.v1"
