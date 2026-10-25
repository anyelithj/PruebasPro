# app_config.py (Python + pydantic-settings) => configuración tipada del servicio leída de variables
# de entorno (12-Factor). Patrón: Singleton (una sola instancia vía lru_cache) + Options/Settings
# (config validada al arrancar, falla rápido).
# Paradigma: POO (clase Settings) + declarativo (tipos y valores por defecto describen la config).

# "from ... import" => importa nombres concretos de un módulo
# Módulo estándar: memoriza el resultado de una función (aquí => Singleton)
from functools import lru_cache
from pathlib import Path  # Módulo estándar: rutas de archivos multiplataforma (Windows/Linux)
from typing import Literal  # Tipos literales: restringe un str a valores concretos

# pydantic-settings: Settings tipados desde .env
from pydantic_settings import BaseSettings, SettingsConfigDict


# "class X(Base)" => herencia: Settings hereda la lectura/validación de entorno de BaseSettings
class Settings(BaseSettings):
    # "model_config" => configuración de Pydantic v2; lee el archivo .env si existe e ignora
    # variables desconocidas
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "Literal[...]" => solo acepta estos valores; cualquier otro detiene el arranque (fail fast)
    APP_ENV: Literal["development", "production", "test"] = "development"
    DATABASE_URL: str  # Sin valor por defecto => obligatoria (postgresql+asyncpg://...)
    # Broker/backend de Celery (base 1: separada de la de Express)
    REDIS_URL: str = "redis://localhost:6379/1"
    MLFLOW_TRACKING_URI: str = ""  # Vacío => MLflow registra en ./mlruns (sin servidor)
    JWT_ACCESS_SECRET: str  # Mismo secreto que Express: valida los JWT emitidos por Auth
    # Claim "iss" que firma Express (src/config/jwt.config.ts)
    JWT_ISSUER: str = "ecommerce-web3-express"
    MODEL_DIR: Path = Path("models")  # Carpeta de artefactos .joblib versionados (fuera de git)
    # Orígenes del navegador permitidos (chat de Next.js en desarrollo); detrás de Nginx todo es
    # mismo origen.
    # pydantic-settings lee la lista como JSON: CORS_ORIGINS='["http://localhost:3000"]'
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


# "@lru_cache" => decorador (patrón Decorator): la primera llamada crea Settings y las siguientes
# reutilizan la instancia
@lru_cache
def get_settings() -> Settings:
    # "type: ignore[call-arg]" => el type checker no sabe que pydantic-settings rellena los campos
    # obligatorios desde el entorno
    return Settings()  # type: ignore[call-arg]
