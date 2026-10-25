"""[DRY][ISP] DTOs de detección de fraude en wallets."""

from pydantic import BaseModel, Field


class FraudRequestDto(BaseModel):
    address: str = Field(min_length=1, max_length=128)
    chain: str | None = Field(default=None, max_length=20)  # 'solana' | 'ethereum'


class FraudResponseDto(BaseModel):
    address: str
    chain: str | None = None
    valid_format: bool
    is_suspicious: bool
    allowed: bool
    risk_level: str  # 'low' | 'medium' | 'high'
    risk_percent: int
    anomaly_score: float
    reasons: list[str] = []
