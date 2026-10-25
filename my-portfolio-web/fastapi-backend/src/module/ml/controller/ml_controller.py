"""[MVC-C][SRP] capa HTTP de ML — delega a los servicios. Modelos cacheados (1 instancia)."""

from functools import lru_cache

from src.common.schemas.api_response import ApiResponse
from src.module.ml.dto.contact_classify_dto import (
    ContactClassifyRequestDto,
    ContactClassifyResponseDto,
)
from src.module.ml.dto.fraud_dto import FraudRequestDto, FraudResponseDto
from src.module.ml.service.contact_classifier_service import ContactClassifierService
from src.module.ml.service.fraud_service import WalletFraudService


@lru_cache(maxsize=1)
def get_fraud_service() -> WalletFraudService:
    """[DI] entrena el IsolationForest una sola vez y lo reutiliza."""
    return WalletFraudService()


@lru_cache(maxsize=1)
def get_contact_classifier() -> ContactClassifierService:
    """[DI] entrena el clasificador TF-IDF una sola vez y lo reutiliza."""
    return ContactClassifierService()


class MlController:
    @staticmethod
    def analyze_wallet(
        service: WalletFraudService, dto: FraudRequestDto
    ) -> ApiResponse[FraudResponseDto]:
        result = service.analyze(dto.address, dto.chain)
        return ApiResponse.ok(FraudResponseDto(**result))

    @staticmethod
    def classify_contact(
        service: ContactClassifierService, dto: ContactClassifyRequestDto
    ) -> ApiResponse[ContactClassifyResponseDto]:
        result = service.classify(dto.message)
        return ApiResponse.ok(ContactClassifyResponseDto(**result))
