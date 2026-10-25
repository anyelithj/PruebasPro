"""Schema Pydantic v2 — respuesta de POST /speech/transcribe.

[Patrón]: DTO.
[Principio]: ISP — solo texto y marcas de tiempo (el audio no se devuelve ni se guarda).
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel


class WordStampOut(BaseModel):
    word: str
    start: float
    end: float


class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration: float
    words: list[WordStampOut]
    model: str
