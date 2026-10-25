# conftest.py (pytest) => fixtures compartidos por las pruebas ML (DRY).

import pytest

from app.config.mlflow_config import configure_mlflow


# "autouse=True" => se aplica a todas las pruebas de la carpeta: MLflow escribe en una carpeta
# temporal (no ensucia el proyecto) y se reconfigura en cada prueba (configure_mlflow es Singleton)
@pytest.fixture(autouse=True)
def isolated_mlflow(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    configure_mlflow.cache_clear()
