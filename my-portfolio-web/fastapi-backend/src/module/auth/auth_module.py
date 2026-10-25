"""[FACADE] agrupa los routers del bounded context de auth."""

from fastapi import APIRouter

from src.module.auth.route.auth_router import router as auth_router

auth_module_router = APIRouter()
auth_module_router.include_router(auth_router)
