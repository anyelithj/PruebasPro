# customer_analytics_schema.py (Pydantic v2) => contratos de salida de analítica de clientes.
# Patrón: DTO. Paradigma: declarativo + tipado estático.

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.shared.types.ml_types import JobStatus


class SegmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    recency_days: int
    frequency: int
    monetary_cents: int
    r_score: int
    f_score: int
    m_score: int
    rfm_segment: str
    cluster: int
    updated_at: datetime


class LTVResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    ltv_cents: int
    horizon_days: int
    method: str
    updated_at: datetime


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    job_id: str
    status: JobStatus
