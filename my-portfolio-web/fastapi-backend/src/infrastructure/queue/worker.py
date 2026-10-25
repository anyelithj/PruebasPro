"""[SRP] Celery app factory — broker/result backend en Redis.

Import perezoso de Celery para no forzar la dependencia si no se usa la cola.
Uso: `celery -A src.infrastructure.queue.worker.celery_app worker`.
"""

from functools import lru_cache
from typing import Any

from src.config.settings import settings


@lru_cache
def get_celery_app() -> Any:
    from celery import Celery

    app = Celery(
        "portfolio",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=[
            "src.infrastructure.queue.email_task",
            "src.infrastructure.queue.notification_task",
        ],
    )
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )
    return app


# Instancia usada por el CLI de Celery.
celery_app = get_celery_app()
