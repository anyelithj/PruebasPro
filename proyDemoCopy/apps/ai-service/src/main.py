"""Entry point del servicio FastAPI.

[Patrón]: Builder — compone la app antes de exponerla.
[Principio]: SRP — main solo orquesta, no lleva lógica de negocio.
[Paradigma]: Funcional + asíncrono.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from src.routers import register_routers
from src.shared.config.settings import get_settings
from src.shared.exceptions.handlers import register_exception_handlers
from src.shared.middleware.cors_middleware import setup_cors
from src.shared.middleware.logging_middleware import setup_logging_middleware


def _setup_logging(level: str) -> None:
    """Configura logging root + libs ruidosas. [Principio]: SRP."""
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # [Silencia ruido]: sqlalchemy logging verbose por default
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # [Silencia ruido]: cada petición HTTP de httpx/huggingface_hub al Hub y la búsqueda de AVX512 de faiss no son errores
    for noisy in ("httpx", "huggingface_hub", "faiss.loader"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


async def _warmup(logger: logging.Logger) -> None:
    from src.modules.assistant.application.use_cases.reindex_knowledge import ReindexKnowledgeUseCase
    from src.modules.assistant.infrastructure.repositories.knowledge_repository import SqlKnowledgeRepository
    from src.modules.feedback.infrastructure.clients.rag_retriever import get_rag_retriever
    from src.shared.config.database import async_session_factory

    try:
        retriever = await asyncio.to_thread(get_rag_retriever)  # Carga torch + modelo fuera del event loop
        store = retriever.store
        if store is not None and store.size == 0:  # Primer arranque: no hay índice en disco
            async with async_session_factory() as session:
                result = await ReindexKnowledgeUseCase(SqlKnowledgeRepository(session), store).execute()
            logger.info("Warm-up RAG: %s", result)
    except Exception as exc:  # noqa: BLE001 — el warm-up nunca tumba el servicio
        logger.warning("Warm-up RAG falló (%s); se reintentará en el primer uso", exc)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Hook startup/shutdown — limpieza de recursos al cerrar. [Patrón]: Lifecycle."""
    logger = logging.getLogger("ai-service")
    logger.info("Lifespan: startup")
    # [Sprint 5.3 · warm-up]: carga el modelo de embeddings y el índice del tutor en segundo plano
    # (tarda ~1 min en CPU) → el servicio arranca de inmediato y la primera consulta no espera.
    warmup = asyncio.create_task(_warmup(logger))
    yield
    warmup.cancel()
    logger.info("Lifespan: shutdown")


def create_app() -> FastAPI:
    """Factoría de la aplicación FastAPI.

    [Patrón]: Factory + Builder — testeable porque crea apps independientes.
    """
    settings = get_settings()
    _setup_logging(settings.log_level)

    app = FastAPI(
        title="AulaDeIdiomas — AI Service",
        description="Calificación, feedback pedagógico y agente tutor con IA",
        version="0.1.0",
        # [Docs solo no-prod]: evita exposición de schemas en producción
        docs_url=f"{settings.api_prefix}/docs" if not settings.is_production else None,
        redoc_url=f"{settings.api_prefix}/redoc" if not settings.is_production else None,
        openapi_url=(
            f"{settings.api_prefix}/openapi.json" if not settings.is_production else None
        ),
        lifespan=lifespan,
    )

    # [Wire middlewares]: orden importa — logging después de CORS para que logs incluyan headers normalizados
    setup_cors(app)
    setup_logging_middleware(app)

    # [Handlers globales]: forma uniforme de errores
    register_exception_handlers(app)

    # [Routers de módulos]
    register_routers(app, prefix=settings.api_prefix)

    # [Health endpoint]: usado por orquestadores (k8s readiness/liveness)
    @app.get("/health", tags=["meta"], include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


# [Instancia]: uvicorn la importa via "src.main:app"
app = create_app()
