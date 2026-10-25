"""[DRY][ISP] DTOs de clasificación de mensajes de contacto."""

from pydantic import BaseModel, Field


class ContactClassifyRequestDto(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ContactClassifyResponseDto(BaseModel):
    category: str  # 'job' | 'freelance' | 'spam'
    priority: str  # 'high' | 'medium' | 'low'
    confidence: float
    scores: dict[str, float]
