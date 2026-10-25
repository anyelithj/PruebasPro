# ml_prediction_model.py (SQLAlchemy 2.0) => entidades del módulo: ModelVersion (versión del modelo)
# y PredictionResult. Patrón: Active Record/Entity (clase = tabla del esquema "ml"). Paradigma: POO
# + tipado estático (Mapped[...]).

import enum  # Módulo estándar: enumeraciones
import uuid  # Módulo estándar: IDs UUID v4 (mismo formato que Prisma @default(uuid()))
from datetime import datetime  # Fechas con zona horaria

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

# "Mapped[T]" => columna tipada; "mapped_column" => su definición
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base  # Base declarativa (esquema "ml")


# "enum.StrEnum" (Python 3.11+) => enum cuyos miembros son str: se serializa a JSON como texto
# ("READY")
class ModelStatus(enum.StrEnum):
    QUEUED = "QUEUED"  # En la cola de Celery
    TRAINING = "TRAINING"  # El worker lo está entrenando
    READY = "READY"  # Disponible para predecir
    FAILED = "FAILED"  # Error durante el entrenamiento (ver "error")


# ModelVersion => cada entrenamiento crea una versión nueva (versionado de modelos con métricas de
# rendimiento)
class ModelVersion(Base):
    __tablename__ = "model_versions"  # Tabla ml.model_versions
    # Restricción única: no puede haber dos "v3" del mismo modelo
    __table_args__ = (UniqueConstraint("model_name", "version"),)

    # "default=lambda: str(uuid.uuid4())" => el ID se genera en Python al crear el objeto
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Clave del Strategy (ej. "demand-xgboost")
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[ModelStatus] = mapped_column(
        Enum(ModelStatus, name="model_status"), default=ModelStatus.QUEUED
    )
    # "Mapped[dict | None]" => columna opcional (nullable) deducida del tipo
    # {"rmse", "mae", "r2"} sobre el set de validación
    metrics: Mapped[dict | None] = mapped_column(JSON)
    artifact_path: Mapped[str | None] = mapped_column(String(255))  # Ruta del .joblib entrenado
    # Trazabilidad con el experimento de MLflow
    mlflow_run_id: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    # "server_default=func.now()" => la BD asigna la fecha (reloj único aunque haya varios workers)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# PredictionResult => predicción diaria de unidades vendidas para un producto, generada por una
# versión concreta
class PredictionResult(Base):
    __tablename__ = "prediction_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # "ForeignKey(..., ondelete='CASCADE')" => borrar una versión obsoleta borra sus predicciones
    model_version_id: Mapped[str] = mapped_column(
        ForeignKey("model_versions.id", ondelete="CASCADE"), index=True
    )
    # ID del producto en Express (public.products)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    horizon_days: Mapped[int] = mapped_column(Integer)
    forecast: Mapped[list] = mapped_column(JSON)  # [{"date": "2026-10-04", "units": 3.2}, ...]
    # A/B testing: "champion" (versión estable) o "challenger" (versión nueva en prueba)
    variant: Mapped[str] = mapped_column(String(10), default="champion")
    # Valores SHAP del primer día predicho: cuánto suma cada feature a la predicción
    explanation: Mapped[dict | None] = mapped_column(JSON)
    # True => producto sin ventas: historia tomada de productos visualmente similares (CLIP)
    cold_start: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
