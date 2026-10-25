"""[SRP] APIRouter(prefix="/ml") — endpoints públicos de Machine Learning.

- POST /ml/fraud/wallet      → detección de fraude/anomalía en wallets (IsolationForest).
- POST /ml/contact/classify  → clasificación de mensajes de contacto (TF-IDF + LogReg).
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from src.common.schemas.api_response import ApiResponse
from src.module.ml.controller.ml_controller import (
    MlController,
    get_contact_classifier,
    get_fraud_service,
)
from src.module.ml.dto.contact_classify_dto import (
    ContactClassifyRequestDto,
    ContactClassifyResponseDto,
)
from src.module.ml.dto.fraud_dto import FraudRequestDto, FraudResponseDto
from src.module.ml.service.contact_classifier_service import ContactClassifierService
from src.module.ml.service.fraud_service import WalletFraudService

router = APIRouter(prefix="/ml", tags=["ml"])

FraudDep = Annotated[WalletFraudService, Depends(get_fraud_service)]
ClassifierDep = Annotated[ContactClassifierService, Depends(get_contact_classifier)]


@router.post("/fraud/wallet", response_model=ApiResponse[FraudResponseDto])
async def analyze_wallet(
    service: FraudDep, dto: FraudRequestDto
) -> ApiResponse[FraudResponseDto]:
    """Analiza una wallet y bloquea bots/spam/direcciones artificiales."""
    return MlController.analyze_wallet(service, dto)


@router.post("/contact/classify", response_model=ApiResponse[ContactClassifyResponseDto])
async def classify_contact(
    service: ClassifierDep, dto: ContactClassifyRequestDto
) -> ApiResponse[ContactClassifyResponseDto]:
    """Clasifica un mensaje en oferta de empleo / freelance / spam con prioridad."""
    return MlController.classify_contact(service, dto)
