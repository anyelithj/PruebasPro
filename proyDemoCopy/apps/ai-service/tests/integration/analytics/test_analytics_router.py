"""Integración del router de Analytics (/api/v1/analytics): rol requerido, cableado HTTP y consulta SQL real.

La consulta SQL se ejecuta contra la base configurada (DATABASE_URL); si no hay base disponible, ese test se omite.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.modules.analytics.presentation.analytics_router import get_repository
from src.shared.dependencies.auth_deps import CurrentUser, get_current_user
from tests.unit.use_cases.analytics.test_analytics import DATA, FakeRepo


def _as(role: str):
    async def user() -> CurrentUser:
        return CurrentUser(id="u1", email="t@test.io", role=role)

    return user


@pytest.fixture
def teacher_client():
    app.dependency_overrides[get_current_user] = _as("TEACHER")
    app.dependency_overrides[get_repository] = lambda: FakeRepo(DATA)
    yield
    app.dependency_overrides = {}


async def test_difficulty_y_anomalias_para_docente(teacher_client) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        r1 = await ac.get("/api/v1/analytics/difficulty", params={"min_attempts": 5})
        r2 = await ac.get("/api/v1/analytics/anomalies")
    assert r1.status_code == 200 and r1.json()["method"] == "kmeans"
    assert any(
        q["question_id"] == "q9" and q["mismatch"] for q in r1.json()["questions"]
    )
    assert r2.status_code == 200 and r2.json()["analyzed"] == len(DATA)


async def test_un_estudiante_no_accede() -> None:
    app.dependency_overrides[get_current_user] = _as("USER")
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            r = await ac.get("/api/v1/analytics/difficulty")
        assert r.status_code == 403
    finally:
        app.dependency_overrides = {}


async def test_la_consulta_sql_es_valida_contra_postgres() -> None:
    """Ejecuta la consulta agregada real (detecta errores de columnas o tipos en jsonb)."""
    from src.modules.analytics.infrastructure.repositories.analytics_repository import (
        SqlAnalyticsRepository,
    )
    from src.shared.config.database import async_session_factory

    try:
        async with async_session_factory() as session:
            stats = await SqlAnalyticsRepository(session).question_stats(1)
    except OSError as exc:  # Sin Postgres (p. ej. CI sin base) → se omite, no falla
        pytest.skip(f"Base de datos no disponible: {exc}")
    assert isinstance(stats, list)
