# celery_config.py (Celery + Redis) => cola de tareas para entrenamientos largos (el endpoint
# responde 202 y no espera).
# Patrón: Singleton (una app Celery por proceso) + Producer/Consumer (la API encola, worker.py
# consume). Paradigma: asíncrono por mensajes (la petición HTTP y el entrenamiento corren en
# procesos distintos).

from celery import Celery  # Celery: framework de colas de tareas distribuidas

from app.config.app_config import get_settings  # Singleton de configuración

settings = get_settings()

# "Celery(nombre, broker, backend)" => Redis transporta los mensajes (broker) y guarda el estado de
# cada job (backend)
celery_app = Celery("ecommerce-fastapi", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

# "conf.update" => opciones globales: JSON (no pickle: evita ejecución de código al deserializar
# mensajes)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Confirma el mensaje al TERMINAR la tarea: si el worker cae, otro la reintenta
    task_acks_late=True,
    # Un entrenamiento a la vez por worker (son tareas pesadas en CPU)
    worker_prefetch_multiplier=1,
)
