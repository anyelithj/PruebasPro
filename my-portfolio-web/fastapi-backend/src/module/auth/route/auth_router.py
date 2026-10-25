"""[SRP] APIRouter(prefix="/auth") aislado — mapea HTTP → AuthController."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.common.schemas.api_response import ApiResponse
from src.module.auth.controller.auth_controller import AuthController, get_auth_service
from src.module.auth.dto.forgot_password_dto import ForgotPasswordDto
from src.module.auth.dto.login_dto import LoginDto
from src.module.auth.dto.refresh_token_dto import RefreshTokenDto
from src.module.auth.dto.register_dto import RegisterDto
from src.module.auth.dto.reset_password_dto import ResetPasswordDto
from src.module.auth.dto.token_response_dto import TokenResponseDto
from src.module.auth.service.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

ServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@router.post(
    "/register",
    response_model=ApiResponse[TokenResponseDto],
    status_code=status.HTTP_201_CREATED,
)
async def register(service: ServiceDep, dto: RegisterDto) -> ApiResponse[TokenResponseDto]:
    return await AuthController.register(service, dto)


@router.post("/login", response_model=ApiResponse[TokenResponseDto])
async def login(service: ServiceDep, dto: LoginDto) -> ApiResponse[TokenResponseDto]:
    return await AuthController.login(service, dto)


@router.post("/refresh", response_model=ApiResponse[TokenResponseDto])
async def refresh(service: ServiceDep, dto: RefreshTokenDto) -> ApiResponse[TokenResponseDto]:
    return await AuthController.refresh(service, dto)


@router.post("/logout", response_model=ApiResponse[None])
async def logout(service: ServiceDep, dto: RefreshTokenDto) -> ApiResponse[None]:
    return await AuthController.logout(service, dto)


@router.post("/forgot-password", response_model=ApiResponse[None])
async def forgot_password(service: ServiceDep, dto: ForgotPasswordDto) -> ApiResponse[None]:
    return await AuthController.forgot_password(service, dto)


@router.post("/reset-password", response_model=ApiResponse[None])
async def reset_password(service: ServiceDep, dto: ResetPasswordDto) -> ApiResponse[None]:
    return await AuthController.reset_password(service, dto)
