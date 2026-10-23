import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.api.main import create_app
from app.config import Settings
from app.providers import MockAIProvider
from app.retrieval.catalog import load_catalog
from app.retrieval.index import build_index

TOKEN = "test-token-test-token-test-token-0000"  # noqa: S105 (token falso solo para tests)


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(_env_file=None, ai_engine_token=TOKEN, provider="mock", qdrant_url=":memory:")


@pytest.fixture(scope="session")
def catalog(settings):
    return load_catalog(settings.catalog_dir)


@pytest.fixture(scope="session")
def indexed(settings, catalog):
    """Qdrant embebido con el catálogo real indexado con el proveedor de prueba."""
    client = QdrantClient(location=":memory:")
    provider = MockAIProvider()
    items, version = catalog
    count = build_index(client, provider, settings.collection, items, version)
    return client, provider, count


@pytest.fixture(scope="session")
def api(settings, indexed) -> TestClient:
    client, provider, _ = indexed
    return TestClient(create_app(settings=settings, provider=provider, client=client))


@pytest.fixture
def auth() -> dict:
    return {"Authorization": f"Bearer {TOKEN}"}
