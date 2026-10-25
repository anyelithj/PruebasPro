"""[DRY] entrada de chat — content + session_id."""

from pydantic import BaseModel, Field


class SendMessageDto(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    session_id: str = Field(min_length=1, max_length=64)
    # "ollama" (chat directo) | "rag" (respuesta con fuentes del portafolio).
    provider: str = Field(default="ollama", max_length=16)


class MessageResponseDto(BaseModel):
    id: str
    session_id: str
    role: str
    content: str

    model_config = {"from_attributes": True}
