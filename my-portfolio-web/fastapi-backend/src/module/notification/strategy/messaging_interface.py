"""[DIP][ISP] ABC de canal de mensajería — send(to, msg) → provider message id."""

from abc import ABC, abstractmethod


class MessagingInterface(ABC):
    @property
    @abstractmethod
    def channel(self) -> str:
        """Nombre del canal — 'whatsapp' | 'telegram'."""

    @abstractmethod
    async def send(self, to: str, message: str) -> str:
        """Envía el mensaje y devuelve el id del proveedor (o '' si stub)."""
