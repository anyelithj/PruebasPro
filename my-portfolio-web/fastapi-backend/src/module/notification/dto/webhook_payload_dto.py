"""[DRY][ISP] payload genérico de webhook validado — n8n / WhatsApp / Telegram."""

from typing import Any

from pydantic import BaseModel, Field


class WebhookPayloadDto(BaseModel):
    # Proveedor emisor: "n8n" | "whatsapp" | "telegram".
    provider: str = Field(min_length=1, max_length=40)
    event: str | None = Field(default=None, max_length=80)
    # Cuerpo libre — cada proveedor tiene su propio shape.
    data: dict[str, Any] = Field(default_factory=dict)
