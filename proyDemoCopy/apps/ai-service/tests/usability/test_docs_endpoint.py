"""Usabilidad · Swagger UI y ReDoc del servicio de IA (Sprint 11.2 · RF-73).

[Qué valida]: /api/v1/docs, /api/v1/redoc y /api/v1/openapi.json responden 200 fuera de producción y
desaparecen (404) en producción → el esquema no se expone en prod.
[Patrón]: Factory (create_app crea una app aislada por prueba) · [Principio]: Seguridad por defecto + SRP
[Paradigma]: Declarativo (pytest) + asíncrono (httpx.AsyncClient)
"""
# `from __future__ import annotations` (Python): anotaciones como texto → sin coste en import
from __future__ import annotations

import pytest  # pytest: marco de pruebas (fixtures, parametrize, monkeypatch)
from httpx import ASGITransport, AsyncClient  # httpx: cliente HTTP; ASGITransport llama a la app en memoria (sin red ni puerto)

from src.main import create_app  # Factoría de la app (no la instancia global) → cada prueba con su propia configuración
from src.shared.config.settings import get_settings

# [DOC_PATHS]: rutas que genera FastAPI con docs_url/redoc_url/openapi_url | `tuple` (Python): colección inmutable
DOC_PATHS = ("/api/v1/docs", "/api/v1/redoc", "/api/v1/openapi.json")


# `async def` (Python): corrutina; asyncio_mode=auto (pytest.ini) la ejecuta sin decorador
async def _status(env: str, path: str, monkeypatch: pytest.MonkeyPatch) -> int:
    """Crea la app con ENV=<env> y devuelve el código HTTP de <path>. [Principio]: DRY (lo usan las dos pruebas)."""
    monkeypatch.setenv("ENV", env)  # `monkeypatch.setenv` (pytest): variable de entorno solo durante la prueba
    get_settings.cache_clear()  # `lru_cache.cache_clear` (functools): Settings es Singleton cacheado → se relee el entorno
    try:
        app = create_app()
        # `async with` (Python): abre y cierra el cliente aunque falle la aserción | sin `lifespan` → no carga modelos de IA
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            return (await client.get(path)).status_code
    finally:  # `finally` (Python): siempre restaura el Singleton para las demás pruebas
        get_settings.cache_clear()


# `@pytest.mark.parametrize` (pytest): una prueba por ruta → el informe dice cuál falla
@pytest.mark.parametrize("path", DOC_PATHS)
async def test_docs_disponibles_fuera_de_produccion(path: str, monkeypatch: pytest.MonkeyPatch) -> None:
    assert await _status("development", path, monkeypatch) == 200


@pytest.mark.parametrize("path", DOC_PATHS)
async def test_docs_ocultos_en_produccion(path: str, monkeypatch: pytest.MonkeyPatch) -> None:
    assert await _status("production", path, monkeypatch) == 404
