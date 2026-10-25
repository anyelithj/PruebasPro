"""CORS middleware configurado desde Settings.

[Patrón]: Middleware (Chain of Responsibility).
[Principio]: SRP.
[Paradigma]: AOP.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.shared.config.settings import get_settings


def setup_cors(app: FastAPI) -> None:
    """Registra CORSMiddleware usando whitelist desde settings."""
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    )
