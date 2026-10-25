# ml_types.py (Python) => tipos de resultado ML compartidos por los módulos (Value Objects).
# Patrón: VO. Paradigma: tipado estático.

import enum


# JobStatus => máquina de estados de los trabajos en segundo plano (Celery):
# QUEUED -> RUNNING -> DONE | FAILED. Mismo enum para recálculo de clientes, entrenamiento del
# recomendador y optimización de precios por lotes (DRY).
class JobStatus(enum.StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
