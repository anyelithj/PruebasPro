"""[SRP] hosts y puertos gRPC aislados. Stub en vertical slice — infra listada, no arrancada."""

from dataclasses import dataclass

from src.config.settings import settings


@dataclass(frozen=True)
class GrpcConfig:
    host: str = settings.grpc_host
    port: int = settings.grpc_port

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"


grpc_config = GrpcConfig()
