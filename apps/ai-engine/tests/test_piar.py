"""SPEC-0017: ajustes razonables del PIAR sin datos personales (generation-piar.v1)."""

import json

import pytest
from pydantic import ValidationError

from app.generation.piar import PIAR_PROMPT, PiarRequest, generate_piar
from app.generation.pipeline import GenerationInvalidError

from .test_resources import (
    ScriptedLLM,
    data_block,
    mock_api,  # noqa: F401 (fixture)
)

REQUEST = {
    "subject": "Matemáticas",
    "grade": "6°",
    "period": "Periodo 1",
    "topics": ["La recta numérica", "Orden de enteros"],
    "barriers": "Le cuesta leer enunciados largos y se distrae con el ruido del salón.",
}
GOOD = {
    "curricular": ["Priorizar la ubicación de enteros en la recta antes de las operaciones."],
    "didactic": ["Dar las instrucciones por pasos y con apoyos visuales en el tablero."],
    "evaluative": ["Permitir responder de forma oral y dar tiempo adicional en las pruebas."],
    "followUp": "Revisar cada semana el avance con una lista de chequeo corta.",
}


def test_ca_0017_04_propone_los_tres_tipos_de_ajuste_con_los_datos_como_datos():
    llm = ScriptedLLM(json.dumps(GOOD))
    result = generate_piar(llm, PiarRequest(**REQUEST))
    assert result.value.didactic == GOOD["didactic"]
    assert llm.calls[0][0].content == PIAR_PROMPT
    data = data_block(llm.calls[0])
    assert data["barreras"] == REQUEST["barriers"]
    assert set(data) == {"tarea", "asignatura", "grado", "periodo", "temas", "barreras"}


@pytest.mark.parametrize(
    "extra",
    [{"studentName": "Juan"}, {"age": 11}, {"diagnosis": "x"}, {"document": "123"}],
)
def test_ca_0017_08_el_pedido_no_admite_datos_personales(extra):
    with pytest.raises(ValidationError):
        PiarRequest(**{**REQUEST, **extra})


@pytest.mark.parametrize(
    ("bad", "expected"),
    [
        ({**GOOD, "evaluative": []}, "'evaluative' debe traer de 1 a 3"),
        ({**GOOD, "followUp": ""}, "Falta 'followUp'"),
        ({**GOOD, "didactic": GOOD["curricular"]}, "repetidos"),
    ],
)
def test_ca_0017_08_salida_incompleta_se_repara(bad, expected):
    llm = ScriptedLLM(json.dumps(bad), json.dumps(GOOD))
    result = generate_piar(llm, PiarRequest(**REQUEST))
    assert result.attempts == 2
    assert expected in llm.calls[1][-1].content


def test_tres_salidas_invalidas_fallan():
    bad = json.dumps({**GOOD, "curricular": []})
    with pytest.raises(GenerationInvalidError):
        generate_piar(ScriptedLLM(bad, bad, bad), PiarRequest(**REQUEST))


def test_endpoint_con_el_llm_de_prueba(mock_api, auth):  # noqa: F811
    response = mock_api.post("/v1/generation/piar-adjustments", json=REQUEST, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["promptVersion"] == "piar.v1"
    assert body["adjustments"]["curricular"] and body["adjustments"]["followUp"]
    extra = mock_api.post(
        "/v1/generation/piar-adjustments", json={**REQUEST, "studentName": "Ana"}, headers=auth
    )
    assert extra.status_code == 422
    assert mock_api.post("/v1/generation/piar-adjustments", json=REQUEST).status_code == 401
