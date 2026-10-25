"""Schema Pydantic v2 — datos de texto de POST /alignment/align (el audio llega aparte, multipart).

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (máx. 200 líneas) + ISP.
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode

# [Regla del producto · RF-119]: en canciones la música reduce la precisión → los tiempos solo se proponen y el editor manual decide
AlignKind = Literal["dialogue", "song"]


class AlignRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    lines: list[str] = Field(..., min_length=1, max_length=200)
    language: LanguageCode
    kind: AlignKind = "dialogue"
