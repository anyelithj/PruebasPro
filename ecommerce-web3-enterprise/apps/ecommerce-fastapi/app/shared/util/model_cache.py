# model_cache.py (TensorFlow) => runtime de deep learning compartido por los modelos de visión/NLP.
# Patrón: Singleton (lru_cache: TensorFlow se configura una sola vez por proceso) + Lazy Loading
# (TensorFlow se importa al primer uso: la API arranca rápido y los procesos que no usan visión,
# como el worker de entrenamientos, no reservan su memoria).
# Ahorro de recursos: límite de hilos de CPU para la inferencia (no acapara la máquina) y logs
# nativos de TensorFlow silenciados.

import asyncio
import os
from collections.abc import Callable
from functools import lru_cache
from types import ModuleType
from typing import Any

from app.shared.middleware.error_middleware import AppError

INFERENCE_THREADS = 2  # Hilos por operación: inferencia de 1 imagen no gana mucho con más núcleos


@lru_cache(maxsize=1)
def tensorflow_runtime() -> ModuleType:
    # Solo errores en el log nativo de TensorFlow
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    import tensorflow as tf  # Import diferido (lazy): solo cuando un modelo se usa por primera vez

    # Debe configurarse antes de ejecutar cualquier operación de TensorFlow
    tf.config.threading.set_intra_op_parallelism_threads(INFERENCE_THREADS)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    return tf


# ModelUnavailableError => el motor (TensorFlow, Ollama) no está instalado, no carga o no responde
class ModelUnavailableError(AppError):
    def __init__(self, engine: str) -> None:
        super().__init__(503, "MODEL_UNAVAILABLE", f"El motor {engine} no está disponible")


# run_model => ejecuta inferencia (CPU) en un hilo para no bloquear el event loop de FastAPI y
# traduce "motor ausente o caído" a 503 (ImportError: librería rota; OSError/ConnectionError:
# servidor de Ollama apagado; ResponseError de Ollama: modelo no descargado). Una sola vía (DRY).
async def run_model(function: Callable[..., Any], *args: Any, engine: str) -> Any:
    import ollama  # Import local: solo para conocer su tipo de error

    try:
        return await asyncio.to_thread(function, *args)
    except (ImportError, OSError, ollama.ResponseError) as error:
        raise ModelUnavailableError(engine) from error
