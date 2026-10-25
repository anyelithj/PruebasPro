"""[DRY] entrada/salida de notificaciones."""

from pydantic import BaseModel, Field


class SendNotificationDto(BaseModel):
    channel: str = Field(pattern="^(whatsapp|telegram|email)$")
    recipient: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=4000)
    event_type: str | None = Field(default=None, max_length=40)


class NotificationResponseDto(BaseModel):
    id: str
    channel: str
    recipient: str
    status: str

    model_config = {"from_attributes": True}
