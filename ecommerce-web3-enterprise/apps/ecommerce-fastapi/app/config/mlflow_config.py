# mlflow_config.py (MLflow) => registro de experimentos: parámetros, métricas y artefactos de cada
# entrenamiento. Patrón: Singleton (configuración aplicada una sola vez por proceso con lru_cache).
# Paradigma: funcional (función idempotente sin estado propio).

from functools import lru_cache  # Memoriza la llamada => la configuración se aplica una sola vez

import mlflow  # MLflow: tracking de experimentos ML (open source)

from app.config.app_config import get_settings


# "@lru_cache" => Singleton funcional: las siguientes llamadas no vuelven a configurar MLflow
@lru_cache
def configure_mlflow(experiment: str) -> None:
    uri = get_settings().MLFLOW_TRACKING_URI
    # "if uri:" => cadena vacía es falsy: sin servidor, MLflow usa la carpeta local ./mlruns
    if uri:
        mlflow.set_tracking_uri(uri)
    mlflow.set_experiment(experiment)  # Crea el experimento si no existe
