"""Schema Pydantic v2 — respuesta de GET /level-classifier/criteria.

[Patrón]: DTO.
[Principio]: transparencia — el docente ve la rúbrica y las bandas con su tipo en Swagger.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel  # `BaseModel` (Pydantic v2): valida y documenta

from src.modules.level_classifier.domain.value_objects.estimated_level import CefrLevel  # Literal A1–C2 (SSOT del dominio)


class CriteriaResponse(BaseModel):
    rubric: dict[CefrLevel, str]  # Descriptor por nivel MCER
    bands: dict[str, list[float]]  # Indicador → 5 cortes entre A1…C2 (la tupla se serializa como lista JSON)
    min_confidence: float  # Por debajo → «estimado» y se sugiere revisión docente
