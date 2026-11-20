"""SPEC-0021 Parte A: preferencias propuestas (generation-preference-suggestions.v1)."""

import json

import pytest
from pydantic import ValidationError

from app.generation.pipeline import GenerationInvalidError
from app.generation.preferences import (
    PREFERENCES_PROMPT,
    PreferenceSuggestionsRequest,
    suggest_preferences,
)

from .test_resources import (
    ScriptedLLM,
    data_block,
    mock_api,  # noqa: F401 (fixture)
)

EDIT = {
    "kind": "EDIT",
    "resourceType": "QUIZ",
    "subject": "Matemáticas",
    "grade": "6°",
    "before": "Si en una mañana fría la temperatura baja de 0 a −3 grados, ¿cuál es la final?",
    "after": "¿Cuánto es 0 − 3?",
}
REQUEST = {
    "signals": [
        EDIT,
        {**EDIT, "resourceType": "EXAM"},
        {
            "kind": "ITEM_DOWN",
            "resourceType": "WORKSHOP",
            "subject": "Matemáticas",
            "grade": "6°",
            "comment": "Muy largo para mis estudiantes",
        },
    ],
    "activePreferences": ["Usa ejemplos del contexto colombiano."],
    "declined": ["Agrega una imagen en cada pregunta."],
}


def out(*suggestions: dict) -> str:
    return json.dumps({"suggestions": list(suggestions)})


SHORT = {
    "text": "Escribe enunciados cortos, de una sola oración.",
    "reason": "Acortaste 2 enunciados y marcaste uno como muy largo.",
    "conflictsWith": None,
}


def test_ca_0021_01_resume_las_senales_como_datos():
    llm = ScriptedLLM(out(SHORT))
    result = suggest_preferences(llm, PreferenceSuggestionsRequest(**REQUEST))
    assert [s.text for s in result.value.suggestions] == [SHORT["text"]]
    assert llm.calls[0][0].content == PREFERENCES_PROMPT
    data = data_block(llm.calls[0])
    assert set(data) == {"tarea", "senales", "preferenciasActivas", "descartadas"}
    assert data["senales"][0]["antes"] == EDIT["before"]


def test_ca_0021_04_descarta_lo_activo_y_lo_descartado_sin_el_modelo():
    repeated = {**SHORT, "text": "Usa ejemplos del contexto colombiano"}
    declined = {**SHORT, "text": "agrega una imagen en cada pregunta"}
    llm = ScriptedLLM(out(repeated, declined, SHORT, SHORT))
    result = suggest_preferences(llm, PreferenceSuggestionsRequest(**REQUEST))
    assert len(llm.calls) == 1
    assert [s.text for s in result.value.suggestions] == [SHORT["text"]]


def test_ca_0021_04_sin_patron_devuelve_lista_vacia():
    result = suggest_preferences(ScriptedLLM(out()), PreferenceSuggestionsRequest(**REQUEST))
    assert result.value.suggestions == []


def test_ca_0021_05_conflicto_con_una_preferencia_activa():
    conflict = {**SHORT, "conflictsWith": 0}
    result = suggest_preferences(
        ScriptedLLM(out(conflict)), PreferenceSuggestionsRequest(**REQUEST)
    )
    assert result.value.suggestions[0].conflictsWith == 0
    wrong = {**SHORT, "conflictsWith": 3}
    llm = ScriptedLLM(out(wrong), out(conflict))
    suggest_preferences(llm, PreferenceSuggestionsRequest(**REQUEST))
    assert "conflictsWith" in llm.calls[1][-1].content


def test_repara_textos_fuera_de_rango_y_falla_tras_tres_intentos():
    long = {**SHORT, "text": "Escribe " + "muy " * 60 + "corto."}
    llm = ScriptedLLM(out(long), out(long), out(long))
    with pytest.raises(GenerationInvalidError):
        suggest_preferences(llm, PreferenceSuggestionsRequest(**REQUEST))
    assert "entre 10 y 160" in llm.calls[1][-1].content


def test_ca_0021_06_el_pedido_no_admite_ids_ni_datos_personales():
    with pytest.raises(ValidationError):
        PreferenceSuggestionsRequest(**{**REQUEST, "teacherName": "Ana"})
    with pytest.raises(ValidationError):
        PreferenceSuggestionsRequest(**{**REQUEST, "signals": [{**EDIT, "resourceId": "r1"}]})
    with pytest.raises(ValidationError):
        PreferenceSuggestionsRequest(**{**REQUEST, "signals": []})


def test_endpoint_con_el_llm_de_prueba(mock_api, auth):  # noqa: F811
    response = mock_api.post("/v1/generation/preference-suggestions", json=REQUEST, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["suggestions"]) == 1
    assert body["meta"]["promptVersion"] == "preference_suggestions.v1"
    assert body["meta"]["qualityRulesVersion"] is None
    bad = mock_api.post(
        "/v1/generation/preference-suggestions", json={**REQUEST, "membershipId": "x"}, headers=auth
    )
    assert bad.status_code == 422
    assert mock_api.post("/v1/generation/preference-suggestions", json=REQUEST).status_code == 401
