# fraud_detection_schema.py (Pydantic v2) => contratos de detección de fraude.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# AnalyzeRequest => señales de la transacción (las calcula Express al crear el pago/pedido)
class AnalyzeRequest(BaseModel):
    user_id: str = Field(max_length=36)
    order_id: str | None = Field(default=None, max_length=36)
    amount_cents: int = Field(ge=0)
    item_count: int = Field(ge=1, le=1000)
    account_age_days: int = Field(ge=0)
    orders_last_24h: int = Field(ge=0)
    distinct_addresses_30d: int = Field(ge=0)
    payment_attempts: int = Field(ge=1)
    hour_of_day: int = Field(ge=0, le=23)
    email_verified: bool
    address_mismatch: bool = False  # Facturación ≠ envío
    # RF-08.11 señales de dispositivo y red (Express: huella del navegador + IP)
    accounts_on_device: int = Field(
        default=1, ge=0
    )  # Cuentas distintas vistas en el mismo dispositivo
    ip_country_mismatch: bool = False  # País de la IP ≠ país de envío
    new_ip: bool = False  # IP nunca vista para esta cuenta (cuenta con historial)
    checkouts_last_hour: int = Field(
        default=0, ge=0
    )  # Velocidad: compras iniciadas en la última hora


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_id: str | None
    user_id: str
    rule_score: float
    anomaly_score: float | None
    classifier_score: float | None
    risk_score: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    explanation: dict[str, Any]
    created_at: datetime


class DismissalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reason: str
    reviewed_by: str
    notes: str
    created_at: datetime


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    risk_level: str
    status: str
    created_at: datetime
    analysis: AnalysisResponse
    dismissal: DismissalResponse | None


# DismissRequest => body de PATCH /alert/:id/dismiss ({ reason, reviewed_by, notes } de la matriz).
# "reviewed_by" se acepta por compatibilidad, pero se registra el usuario autenticado (no
# suplantable)
class DismissRequest(BaseModel):
    reason: Literal["FALSE_POSITIVE", "CONFIRMED_FRAUD", "OTHER"]
    reviewed_by: str | None = Field(default=None, max_length=36)
    notes: str = Field(default="", max_length=2000)
