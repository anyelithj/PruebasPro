"""[SRP] Pydantic BaseSettings — todas las variables tipadas en un solo lugar."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = Field(default="Portfolio API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=list, alias="CORS_ORIGINS"
    )

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/portfolio",
        alias="DATABASE_URL",
    )

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # JWT
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_ttl_min: int = Field(default=15, alias="JWT_ACCESS_TTL_MIN")
    jwt_refresh_ttl_days: int = Field(default=7, alias="JWT_REFRESH_TTL_DAYS")

    # Reseteo de contraseña (sin servicio de correo: el enlace se imprime en los logs)
    frontend_url: str = Field(default="http://localhost:3001", alias="FRONTEND_URL")
    password_reset_ttl_min: int = Field(default=30, alias="PASSWORD_RESET_TTL_MINUTES")

    # Contacto: destinatario del aviso cuando alguien envía el formulario público.
    contact_notify_email: str = Field(
        default="owner@portfolio.dev", alias="CONTACT_NOTIFY_EMAIL"
    )

    # gRPC
    grpc_host: str = Field(default="0.0.0.0", alias="GRPC_HOST")
    grpc_port: int = Field(default=50051, alias="GRPC_PORT")

    # Rate limit
    rate_limit_per_minute: int = Field(default=120, alias="RATE_LIMIT_PER_MINUTE")
    # Límite estricto para endpoints blockchain — protege los fondos de prueba.
    blockchain_rate_limit_per_minute: int = Field(
        default=10, alias="BLOCKCHAIN_RATE_LIMIT_PER_MINUTE"
    )

    # ── IA open source (Ollama — sin API keys de terceros) ──────────────
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_chat_model: str = Field(default="qwen2.5:7b", alias="OLLAMA_CHAT_MODEL")
    ollama_embed_model: str = Field(default="nomic-embed-text", alias="OLLAMA_EMBED_MODEL")
    ai_temperature: float = Field(default=0.7, alias="AI_TEMPERATURE")
    # Modelo del agente blockchain — Qwen2.5 tiene tool calling nativo.
    blockchain_ai_model: str = Field(default="qwen2.5:7b", alias="BLOCKCHAIN_AI_MODEL")

    # ── Solana (Opción A) ───────────────────────────────────────────────
    enable_solana_agent: bool = Field(default=True, alias="ENABLE_SOLANA_AGENT")
    solana_rpc_url: str = Field(
        default="https://api.devnet.solana.com", alias="SOLANA_RPC_URL"
    )
    solana_network: str = Field(default="devnet", alias="SOLANA_NETWORK")
    # NUNCA versionar — se carga desde .env (que está en .gitignore).
    solana_agent_private_key: str = Field(default="", alias="SOLANA_AGENT_PRIVATE_KEY")

    # ── Ethereum Sepolia (Opción B) ─────────────────────────────────────
    enable_ethereum_agent: bool = Field(default=True, alias="ENABLE_ETHEREUM_AGENT")
    eth_rpc_url: str = Field(
        default="https://sepolia.infura.io/v3/your_project_id", alias="ETH_RPC_URL"
    )
    eth_network: str = Field(default="sepolia", alias="ETH_NETWORK")
    # NUNCA versionar.
    eth_agent_private_key: str = Field(default="", alias="ETH_AGENT_PRIVATE_KEY")

    # ── Notificaciones (canales + webhooks) ─────────────────────────────
    telegram_bot_token: str = Field(default="", alias="TELEGRAM_BOT_TOKEN")
    telegram_chat_id: str = Field(default="", alias="TELEGRAM_CHAT_ID")
    whatsapp_token: str = Field(default="", alias="WHATSAPP_TOKEN")
    whatsapp_phone_id: str = Field(default="", alias="WHATSAPP_PHONE_ID")
    # Secreto para validar la firma HMAC de los webhooks entrantes (n8n/WhatsApp/Telegram).
    webhook_hmac_secret: str = Field(default="change-me", alias="WEBHOOK_HMAC_SECRET")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """[DI] cache singleton — una sola instancia por proceso."""
    return Settings()


settings = get_settings()
