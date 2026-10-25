# model_loader.py (joblib) => carga artefactos .joblib y los mantiene en memoria entre peticiones.
# Patrón: Singleton por artefacto + Cache (lru_cache): cada versión es inmutable, así que cachear
# por ruta es seguro. Paradigma: funcional (función memoizada).

from functools import lru_cache  # Memoización con límite (LRU: expulsa la versión menos usada)
from typing import Any

import joblib  # Serialización eficiente de modelos (arrays NumPy) — viene con scikit-learn


# "maxsize=8" => hasta 8 versiones en memoria (A/B de versiones sin recargar del disco en cada
# request)
@lru_cache(maxsize=8)
def load_model(artifact_path: str) -> Any:
    return joblib.load(artifact_path)
