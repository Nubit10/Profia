"""SPEC-0016: talleres con enfoque DUA a elección del docente (ADR-0014)."""

import json

import pytest

from app.generation.pipeline import GenerationInvalidError
from app.generation.resources import (
    UDL_PROMPT,
    WORKSHOP_PROMPT,
    ItemRequest,
    WorkshopRequest,
    generate_workshop,
    regenerate_item,
    workshop_prompt_version,
)

from .test_resources import (  # noqa: F401 (mock_api es un fixture)
    CONTEXT,
    GOOD_MOMENTS,
    ITEM,
    WORKSHOP,
    ScriptedLLM,
    data_block,
    mock_api,  # fixture
)

UDL = {
    "representation": ["Lectura corta con imágenes", "Explicación oral con el tablero"],
    "expression": ["Escribir en el cuaderno", "Explicar en voz alta", "Hacer un dibujo"],
    "engagement": "Busca un ejemplo de números negativos en tu barrio y elige cuál usar.",
    "supports": ["Ejemplo resuelto paso a paso"],
    "challenge": "Inventa un problema para tu grupo.",
}
GUIDE = {
    "barriers": [
        {"barrier": "Textos largos", "support": "Leer en voz alta por partes"},
        {"barrier": "Vocabulario nuevo", "support": "Banco de palabras con imágenes"},
    ],
    "selfAssessment": ["Puedo ubicar números en la recta", "Puedo explicar qué es un opuesto"],
}


def udl_workshop(udl=UDL, guide=GUIDE) -> str:
    levels = iter(["UNDERSTAND", "UNDERSTAND", "APPLY", "APPLY"])
    out = {
        "title": "Taller de la recta numérica",
        "purpose": "Que el estudiante compare números enteros en la recta.",
        "studentInstructions": "Trabaja en parejas.",
        "materials": ["Cuaderno"],
        "moments": [
            {
                "name": name,
                "activities": [
                    {
                        "title": f"{name} {k}",
                        "instructions": "Dibuja una recta numérica y ubica los números dados.",
                        "durationMinutes": 15,
                        "expectedOutcome": "Recta con los números ubicados.",
                        "cognitiveLevel": next(levels),
                        "dbaCodes": ["MEN-DBA-MAT-V2-G6-01"],
                        **({"udl": udl} if udl is not None else {}),
                    }
                    for k in range(n)
                ],
            }
            for name, n in GOOD_MOMENTS
        ],
        "teacherGuidance": ["Revisa que ubiquen el cero."],
    }
    if guide is not None:
        out["udlGuide"] = guide
    return json.dumps(out)


REQUEST = {**WORKSHOP, "udl": True}


def test_ca_0016_01_taller_con_dua_trae_opciones_y_guia():
    llm = ScriptedLLM(udl_workshop())
    result = generate_workshop(llm, WorkshopRequest(**REQUEST))
    system, _ = llm.calls[0]
    assert UDL_PROMPT in system.content
    assert data_block(llm.calls[0])["enfoqueDUA"] is True
    activities = [a for m in result.value.moments for a in m.activities]
    assert all(a.udl and len(a.udl.expression) >= 2 for a in activities)
    assert result.value.udlGuide and len(result.value.udlGuide.barriers) == 2


def test_ca_0016_02_sin_dua_no_se_pide_y_se_descarta_si_llega():
    llm = ScriptedLLM(udl_workshop())
    result = generate_workshop(llm, WorkshopRequest(**WORKSHOP))
    assert llm.calls[0][0].content == WORKSHOP_PROMPT
    assert "enfoqueDUA" not in data_block(llm.calls[0])
    assert all(a.udl is None for m in result.value.moments for a in m.activities)
    assert result.value.udlGuide is None


@pytest.mark.parametrize(
    ("bad", "expected"),
    [
        (udl_workshop(udl=None), "falta el objeto 'udl'"),
        (udl_workshop(udl={**UDL, "expression": ["Escribir"]}), "2 formas de responder"),
        (udl_workshop(udl={**UDL, "representation": []}), "2 formas de presentar"),
        (udl_workshop(udl={**UDL, "supports": []}), "al menos un apoyo"),
        (udl_workshop(guide=None), "Falta 'udlGuide'"),
        (udl_workshop(guide={**GUIDE, "selfAssessment": ["Puedo"]}), "de 2 a 4 frases"),
    ],
)
def test_ca_0016_03_dua_incompleto_se_repara(bad, expected):
    llm = ScriptedLLM(bad, udl_workshop())
    result = generate_workshop(llm, WorkshopRequest(**REQUEST))
    assert result.attempts == 2
    assert expected in llm.calls[1][-1].content


def test_ca_0016_03_dua_incompleto_tras_tres_intentos_falla():
    bad = udl_workshop(guide=None)
    with pytest.raises(GenerationInvalidError):
        generate_workshop(ScriptedLLM(bad, bad, bad), WorkshopRequest(**REQUEST))


def test_ca_0016_04_regenerar_una_actividad_dua_conserva_el_dua():
    current = json.loads(udl_workshop())["moments"][0]["activities"][0]
    without = {**current, "title": "Otra actividad", "udl": None}
    new = {**current, "title": "Otra actividad de la recta"}
    llm = ScriptedLLM(json.dumps({"item": without}), json.dumps({"item": new}))
    request = ItemRequest(
        **{**ITEM, "kind": "WORKSHOP_ACTIVITY", "current": current, "questionTypes": [],
           "moment": "Inicio"}
    )  # fmt: skip
    result = regenerate_item(llm, request)
    assert UDL_PROMPT in llm.calls[0][0].content
    assert "falta el objeto 'udl'" in llm.calls[1][-1].content
    assert result.value.item.udl is not None


def test_ca_0016_07_version_del_prompt_con_el_anexo():
    assert workshop_prompt_version(WorkshopRequest(**REQUEST)) == "workshop.v1+udl.v1"
    assert workshop_prompt_version(WorkshopRequest(**WORKSHOP)) == "workshop.v1"


def test_ca_0016_endpoint_con_el_llm_de_prueba(mock_api, auth):  # noqa: F811
    response = mock_api.post("/v1/generation/workshop", json=REQUEST, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["promptVersion"] == "workshop.v1+udl.v1"
    assert body["workshop"]["udlGuide"]["barriers"]
    assert all(a["udl"] for m in body["workshop"]["moments"] for a in m["activities"])
    plain = mock_api.post("/v1/generation/workshop", json=WORKSHOP, headers=auth).json()
    assert plain["workshop"].get("udlGuide") is None


def test_rn_06_la_peticion_dua_no_admite_datos_personales():
    with pytest.raises(ValueError):
        WorkshopRequest(**{**REQUEST, "studentName": "Juan"})
    assert CONTEXT["subject"]
