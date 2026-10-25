"""[ISP] shape de salida de tokens."""

from pydantic import BaseModel

from src.module.user.dto.user_response_dto import UserResponseDto


class TokenResponseDto(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponseDto
