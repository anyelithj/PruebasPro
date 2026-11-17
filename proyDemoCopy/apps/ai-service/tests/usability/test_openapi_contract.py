"""Usabilidad · contrato OpenAPI 3 del servicio de IA (Sprint 11.2 · RF-73).

[Qué valida]: todos los endpoints aparecen en /api/v1/openapi.json bajo el prefijo, agrupados por tag,
con operationId único y con esquema de cuerpo/respuesta (modelos Pydantic) → NestJS y los frontends
consumen un contrato completo.
[Patrón]: Contract Testing · [Principio]: SSOT (el esquema sale del código, no de un documento aparte)
[Paradigma]: Declarativo (pytest) + Funcional (comprensiones sin mutación)
"""
from __future__ import annotations

from typing import Any  # typing.Any: el documento OpenAPI es JSON libre

import pytest

from src.main import app  # Instancia real que levanta uvicorn (src.main:app)

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}  # `set` (Python): pertenencia O(1)


# `@pytest.fixture(scope="module")` (pytest): genera el esquema una sola vez por archivo
@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    return app.openapi()  # `app.openapi()` (FastAPI): mismo documento que sirve /openapi.json


# [operations]: aplana paths × métodos → [(id legible, operación)] | `list[tuple[...]]` (Python): tipado del resultado
def _operations(schema: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        (f"{method.upper()} {path}", op)
        for path, item in schema["paths"].items()
        for method, op in item.items()
        if method in HTTP_METHODS
    ]


def test_info_y_version(schema: dict[str, Any]) -> None:
    assert schema["openapi"].startswith("3.")  # OpenAPI 3.x
    assert schema["info"]["title"] == "AulaDeIdiomas — AI Service"


def test_rutas_bajo_prefijo(schema: dict[str, Any]) -> None:
    paths = list(schema["paths"])
    assert len(paths) > 10  # Grading, Feedback, Assistant, Analytics, Language tools… → número bajo = router sin registrar
    assert all(p.startswith("/api/v1") for p in paths)  # `all` (Python): True si todas cumplen


def test_toda_operacion_tiene_tag(schema: dict[str, Any]) -> None:
    # [Mensaje útil]: lista de operaciones sin tag en vez de un booleano
    assert [op_id for op_id, op in _operations(schema) if not op.get("tags")] == []


def test_operation_id_unico(schema: dict[str, Any]) -> None:
    ids = [op["operationId"] for _, op in _operations(schema)]
    assert len(ids) == len(set(ids))  # Mismo tamaño que el conjunto = sin duplicados


def test_toda_operacion_declara_respuesta_exitosa(schema: dict[str, Any]) -> None:
    # Cada operación documenta al menos un 2xx → el cliente sabe qué recibe
    missing = [op_id for op_id, op in _operations(schema) if not any(code.startswith("2") for code in op["responses"])]
    assert missing == []


def test_cuerpos_con_esquema(schema: dict[str, Any]) -> None:
    # [Type-Safe]: todo requestBody JSON referencia un modelo Pydantic (no un objeto libre)
    sin_esquema = [
        op_id
        for op_id, op in _operations(schema)
        if (body := op.get("requestBody"))  # `:=` (Python 3.8+): operador morsa, asigna y evalúa
        and "application/json" in body["content"]
        and not body["content"]["application/json"].get("schema")
    ]
    assert sin_esquema == []


def test_respuestas_2xx_con_esquema(schema: dict[str, Any]) -> None:
    # [Sprint 11.2]: toda respuesta 2xx con cuerpo (JSON, SSE o WAV) declara `schema` → el cliente sabe qué recibe; 204 no lleva cuerpo
    sin_esquema = [
        f"{op_id} {code}"
        for op_id, op in _operations(schema)
        for code, resp in op["responses"].items()
        if code.startswith("2") and code != "204"
        and not any(media.get("schema") for media in resp.get("content", {}).values())  # `any` (Python): basta un tipo de contenido con esquema
    ]
    assert sin_esquema == []
