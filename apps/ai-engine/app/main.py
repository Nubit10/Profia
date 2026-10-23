"""Punto de entrada ASGI: `uv run uvicorn app.main:app --port 8100`."""

import logging

from .api.main import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = create_app()
