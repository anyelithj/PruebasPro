"""[MVC-C][SRP] capa HTTP de auth — solo delega al AuthService."""

from src.common.dependencies.db_dependency import DbSession
from src.common.schemas.api_response import ApiResponse
from src.module.auth.dto.forgot_password_dto import ForgotPasswordDto
from src.module.auth.dto.login_dto import LoginDto
from src.module.auth.dto.refresh_token_dto import RefreshTokenDto
from src.module.auth.dto.register_dto import RegisterDto
from src.module.auth.dto.reset_password_dto import ResetPasswordDto
from src.module.auth.dto.token_response_dto import TokenResponseDto
from src.module.auth.repository.auth_repository import AuthRepository
from src.module.auth.service.auth_service import AuthService
from src.module.auth.service.token_service import TokenService
from src.module.user.repository.user_repository import UserRepository


def get_auth_service(session: DbSession) -> AuthService:
    """[DI] compone user repo + auth repo + token service → AuthService."""
    return AuthService(
        user_repository=UserRepository(session),
        auth_repository=AuthRepository(session),
        token_service=TokenService(),
    )


class AuthController:
    @staticmethod
    async def register(
        service: AuthService, dto: RegisterDto
    ) -> ApiResponse[TokenResponseDto]:
        return ApiResponse.ok(await service.register(dto), "Registered")

    @staticmethod
    async def login(service: AuthService, dto: LoginDto) -> ApiResponse[TokenResponseDto]:
        return ApiResponse.ok(await service.login(dto), "Logged in")

    @staticmethod
    async def refresh(
        service: AuthService, dto: RefreshTokenDto
    ) -> ApiResponse[TokenResponseDto]:
        return ApiResponse.ok(await service.refresh(dto), "Token refreshed")

    @staticmethod
    async def logout(service: AuthService, dto: RefreshTokenDto) -> ApiResponse[None]:
        await service.logout(dto)
        return ApiResponse.ok(None, "Logged out")

    @staticmethod
    async def forgot_password(
        service: AuthService, dto: ForgotPasswordDto
    ) -> ApiResponse[None]:
        await service.forgot_password(dto)
        # Mensaje neutro a propósito: no revela si el email está registrado.
        return ApiResponse.ok(None, "If the email exists, a reset link was sent")

    @staticmethod
    async def reset_password(
        service: AuthService, dto: ResetPasswordDto
    ) -> ApiResponse[None]:
        await service.reset_password(dto)
        return ApiResponse.ok(None, "Password updated")
