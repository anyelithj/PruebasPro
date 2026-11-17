"""Prompts versionados del LLM propio (RF-144 · RNF-35).

El prompt del corrector vive en `corrector_system.md` TAL CUAL (Anexo A): servicio, dataset QLoRA y evaluación lo leen del mismo archivo.
Su versión = nombre + primeros 12 caracteres del SHA-256 del contenido → cualquier cambio del texto cambia la versión registrada en la trazabilidad.
[Patrón]: Configuration as Data + Content Hash | [Principio]: SSOT + trazabilidad | [Paradigma]: Declarativo.
"""

from hashlib import sha256  # stdlib: huella del contenido
from pathlib import Path  # stdlib: ruta del archivo junto a este módulo

_DIR = Path(__file__).parent  # `Path(__file__)`: carpeta de este paquete (no depende del directorio de trabajo)

CORRECTOR_PROMPT: str = (_DIR / "corrector_system.md").read_text(encoding="utf-8")  # Se lee una vez al importar
CORRECTOR_PROMPT_VERSION: str = f"corrector_system@{sha256(CORRECTOR_PROMPT.encode('utf-8')).hexdigest()[:12]}"
