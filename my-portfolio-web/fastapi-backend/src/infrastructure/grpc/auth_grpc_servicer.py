"""[ADAPTER] expone la validación de tokens auth vía gRPC a NestJS."""

import logging
from typing import Any

from src.common.constants.app_constants import TOKEN_TYPE_ACCESS
from src.common.utils.jwt_util import decode_token

logger = logging.getLogger(__name__)


def register(server: Any) -> bool:
    try:
        from src.infrastructure.grpc.generated import auth_pb2, auth_pb2_grpc
    except ImportError:
        logger.warning("Stubs auth_pb2 no generados — servicer no registrado")
        return False

    class AuthServicer(auth_pb2_grpc.AuthServiceServicer):
        async def ValidateToken(self, request, context):  # noqa: N802
            try:
                payload = decode_token(request.access_token)
                if payload.get("type") != TOKEN_TYPE_ACCESS:
                    raise ValueError("wrong token type")
                return auth_pb2.ValidateTokenResponse(
                    valid=True,
                    user_id=payload.get("sub", ""),
                    email=payload.get("email", ""),
                    role=payload.get("role", ""),
                )
            except Exception:  # noqa: BLE001
                return auth_pb2.ValidateTokenResponse(valid=False)

    auth_pb2_grpc.add_AuthServiceServicer_to_server(AuthServicer(), server)
    return True
