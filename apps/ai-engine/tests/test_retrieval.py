from app.retrieval.catalog import GRADES
from app.retrieval.search import search_curriculum


def test_ca_0005_01_indexa_un_punto_por_item_con_metadatos(indexed, catalog, settings):
    client, _, count = indexed
    items, version = catalog
    assert count == len(items) == 223
    points, _ = client.scroll(settings.collection, limit=500, with_payload=True)
    codes = {p.payload["code"] for p in points}
    assert codes == {i.code for i in items}
    sample = next(p.payload for p in points if p.payload["code"] == "MEN-DBA-MAT-V2-G6-01")
    assert sample["area"] == "MATEMATICAS"
    assert sample["grades"] == ["G6"]
    assert sample["source_key"] == "MEN-DBA-MAT-V2"
    assert sample["catalog_version"] == version


def test_ca_0005_02_los_filtros_se_aplican_antes_del_ranking(indexed, settings):
    client, provider, _ = indexed
    for area, grade in [("MATEMATICAS", "G6"), ("LENGUAJE", "G3"), ("TRANSICION", "TRANSICION")]:
        hits = search_curriculum(
            client, provider, settings.collection, "lectura números textos", area=area, grade=grade
        )
        assert hits, (area, grade)
        prefix = {"MATEMATICAS": "MEN-DBA-MAT", "LENGUAJE": "MEN-DBA-LEN"}.get(area, "MEN-DBA-TRA")
        assert all(h.code.startswith(prefix) for h in hits)
        if grade != "TRANSICION":
            assert all(f"-{grade}-" in h.code for h in hits)


def test_una_busqueda_lexica_encuentra_el_dba_esperado(indexed, settings):
    client, provider, _ = indexed
    hits = search_curriculum(
        client,
        provider,
        settings.collection,
        "derivadas de funciones y sus propiedades",
        area="MATEMATICAS",
        grade="G11",
        limit=5,
    )
    assert "MEN-DBA-MAT-V2-G11-08" in [h.code for h in hits]


def test_respeta_el_limite(indexed, settings):
    client, provider, _ = indexed
    hits = search_curriculum(client, provider, settings.collection, "texto", limit=3)
    assert len(hits) == 3


def test_grados_conocidos():
    assert GRADES[0] == "JARDIN" and GRADES[-1] == "G11"
