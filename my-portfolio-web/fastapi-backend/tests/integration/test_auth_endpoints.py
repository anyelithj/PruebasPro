"""[TDD] integración HTTP de auth — app real con DB SQLite inyectada por override."""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.infrastructure.database.base_model import Base
from src.infrastructure.database.session import get_db
from src.main import create_app
from src.module.auth.model.session_model import SessionModel  # noqa: F401
from src.module.user.model.user_model import UserModel  # noqa: F401


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_db():
        async with factory() as session:
            yield session
            await session.commit()

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def test_register_and_login_flow(client: AsyncClient) -> None:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"name": "Ana", "email": "ana@test.dev", "password": "supersecret"},
    )
    assert reg.status_code == 201
    body = reg.json()
    assert body["success"] is True
    assert body["data"]["access_token"]

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "ana@test.dev", "password": "supersecret"},
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]

    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "ana@test.dev"


async def test_me_without_token_is_unauthorized(client: AsyncClient) -> None:
    res = await client.get("/api/v1/users/me")
    assert res.status_code == 401
