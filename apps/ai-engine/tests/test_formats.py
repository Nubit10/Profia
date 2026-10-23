"""Formato propio del docente (SPEC-0010): análisis del formato y taller con sus secciones."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.main import create_app
from app.generation.formats import FormatRequest, analyze_format
from app.generation.resources import WorkshopRequest, generate_workshop
from app.providers import LLMChain, MockLLM

from .test_resources import WORKSHOP, ScriptedLLM, data_block

FORMAT = {
    "headerLabels": ["INSTITUCIÓN EDUCATIVA", "ÁREA", "DOCENTE", "NOMBRE DEL ESTUDIANTE", "FECHA"],
    "sections": [
        {"title": "Saberes previos", "hasBody": False},
        {"title": "Conceptualización", "hasBody": False},
        {"title": "Actividades de práctica", "hasBody": False},
        {"title": "Autoevaluación", "hasBody": True},
    ],
}
GOOD_FORMAT = {
    "header": [
        {"label": "INSTITUCIÓN EDUCATIVA", "source": "INSTITUTION"},
        {"label": "ÁREA", "source": "SUBJECT"},
        {"label": "DOCENTE", "source": "TEACHER"},
        {"label": "NOMBRE DEL ESTUDIANTE", "source": "BLANK"},
        {"label": "FECHA", "source": "BLANK"},
    ],
    "sections": [
        {"title": "Saberes previos", "kind": "ACTIVITIES", "purpose": "Activar lo que ya saben"},
        {"title": "Conceptualización", "kind": "TEXT", "purpose": "Explicar el concepto"},
        {"title": "Actividades de práctica", "kind": "ACTIVITIES", "purpose": "Practicar el tema"},
        {"title": "Autoevaluación", "kind": "FIXED", "purpose": ""},
    ],
}


def test_ca_0010_01_el_analisis_propone_origen_y_tipo():
    llm = ScriptedLLM(json.dumps(GOOD_FORMAT))
    result = analyze_format(llm, FormatRequest(**FORMAT))
    assert [h.source for h in result.value.header] == [
        "INSTITUTION", "SUBJECT", "TEACHER", "BLANK", "BLANK",
    ]  # fmt: skip
    assert [s.kind for s in result.value.sections] == ["ACTIVITIES", "TEXT", "ACTIVITIES", "FIXED"]
    data = data_block(llm.calls[0])
    assert data["encabezado"] == FORMAT["headerLabels"]
    assert data["secciones"][3] == {"titulo": "Autoevaluación", "tieneTexto": True}


@pytest.mark.parametrize(
    ("bad", "expected"),
    [
        ({**GOOD_FORMAT, "header": GOOD_FORMAT["header"][:4]}, "mismas etiquetas"),
        (
            {**GOOD_FORMAT, "sections": [{**s, "kind": "TEXT"} for s in GOOD_FORMAT["sections"][:3]]
             + [GOOD_FORMAT["sections"][3]]},
            "al menos una sección ACTIVITIES",
        ),
        (
            {**GOOD_FORMAT, "sections": [{**GOOD_FORMAT["sections"][0], "kind": "FIXED"}]
             + GOOD_FORMAT["sections"][1:]},
            "solo puede ser FIXED",
        ),
        (
            {**GOOD_FORMAT, "sections": [{**GOOD_FORMAT["sections"][0], "purpose": ""}]
             + GOOD_FORMAT["sections"][1:]},
            "'purpose'",
        ),
    ],
)  # fmt: skip
def test_el_validador_del_formato_pide_reparacion(bad, expected):
    llm = ScriptedLLM(json.dumps(bad), json.dumps(GOOD_FORMAT))
    result = analyze_format(llm, FormatRequest(**FORMAT))
    assert result.attempts == 2
    assert expected in llm.calls[1][-1].content


def test_ca_0010_02_el_contrato_no_admite_valores_ni_textos():
    with pytest.raises(ValidationError):
        FormatRequest(**{**FORMAT, "headerValues": ["Ana Pérez"]})
    with pytest.raises(ValidationError):
        FormatRequest(
            **{**FORMAT, "sections": [{"title": "Autoevaluación", "body": "Marca con X"}]}
        )


CUSTOM = {
    **WORKSHOP,
    "itemCount": 3,
    "structure": "CUSTOM",
    "customSections": [
        {"title": "Saberes previos", "kind": "ACTIVITIES", "purpose": "Activar lo que ya saben"},
        {"title": "Conceptualización", "kind": "TEXT", "purpose": "Explicar el concepto"},
        {"title": "Actividades de práctica", "kind": "ACTIVITIES", "purpose": "Practicar"},
    ],
}


def custom_out(texts=None, moments=None) -> str:
    activity = {
        "title": "Ubica números",
        "instructions": "Dibuja una recta numérica y ubica los números dados.",
        "durationMinutes": 15,
        "expectedOutcome": "Recta con los números ubicados.",
        "cognitiveLevel": "APPLY",
        "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"],
    }
    levels = iter(["UNDERSTAND", "APPLY", "APPLY"])
    return json.dumps(
        {
            "title": "Taller de la recta",
            "purpose": "Que el estudiante compare números enteros en la recta.",
            "studentInstructions": "Trabaja en parejas.",
            "materials": [],
            "moments": [
                {
                    "name": name,
                    "activities": [
                        {**activity, "title": f"{name} {k}", "cognitiveLevel": next(levels)}
                        for k in range(n)
                    ],
                }
                for name, n in (moments or [("saberes previos", 1), ("Actividades de práctica", 2)])
            ],
            "sectionTexts": texts
            if texts is not None
            else [
                {
                    "title": "Conceptualización",
                    "content": "Los enteros incluyen los negativos, el cero y los positivos.",
                }
            ],
            "teacherGuidance": ["Revisa que ubiquen el cero."],
        }
    )


def test_ca_0010_03_el_taller_sigue_las_secciones_del_formato():
    llm = ScriptedLLM(custom_out())
    result = generate_workshop(llm, WorkshopRequest(**CUSTOM))
    workshop = result.value
    assert [m.name for m in workshop.moments] == ["Saberes previos", "Actividades de práctica"]
    assert [t.title for t in workshop.sectionTexts] == ["Conceptualización"]
    data = data_block(llm.calls[0])
    assert data["momentos"] == ["Saberes previos", "Actividades de práctica"]
    assert data["secciones"][1] == {
        "titulo": "Conceptualización",
        "tipo": "texto",
        "proposito": "Explicar el concepto",
    }
    assert "formato propio del docente" in llm.calls[0][0].content


def test_el_taller_personalizado_exige_los_textos_de_las_secciones():
    llm = ScriptedLLM(custom_out(texts=[]), custom_out())
    result = generate_workshop(llm, WorkshopRequest(**CUSTOM))
    assert result.attempts == 2
    assert "secciones de texto: Conceptualización" in llm.calls[1][-1].content


@pytest.mark.parametrize(
    "change",
    [
        {"customSections": [{"title": "Lectura", "kind": "TEXT", "purpose": "Leer"}]},
        {"customSections": CUSTOM["customSections"] + [CUSTOM["customSections"][0]]},
        {"structure": "START_DEVELOPMENT_CLOSE", "itemCount": 3},
        {"itemCount": 1},
    ],
)
def test_peticiones_personalizadas_invalidas(change):
    with pytest.raises(ValidationError):
        WorkshopRequest(**{**CUSTOM, **change})


def test_endpoints_de_formato_y_taller_personalizado(settings, indexed, auth):
    client, provider, _ = indexed
    api = TestClient(
        create_app(settings=settings, provider=provider, client=client, llm=LLMChain([MockLLM()]))
    )
    analysis = api.post("/v1/formats/analyze", json=FORMAT, headers=auth)
    assert analysis.status_code == 200, analysis.text
    body = analysis.json()
    assert [h["source"] for h in body["header"]][:4] == [
        "INSTITUTION",
        "SUBJECT",
        "TEACHER",
        "BLANK",
    ]
    assert body["sections"][3]["kind"] == "FIXED"
    assert body["meta"]["promptVersion"] == "format_analysis.v1"
    assert api.post("/v1/formats/analyze", json=FORMAT).status_code == 401

    workshop = api.post("/v1/generation/workshop", json=CUSTOM, headers=auth)
    assert workshop.status_code == 200, workshop.text
    assert workshop.json()["meta"]["promptVersion"] == "workshop.v2"
    assert workshop.json()["workshop"]["sectionTexts"][0]["title"] == "Conceptualización"
    standard = api.post("/v1/generation/workshop", json=WORKSHOP, headers=auth)
    assert standard.json()["meta"]["promptVersion"] == "workshop.v1"
