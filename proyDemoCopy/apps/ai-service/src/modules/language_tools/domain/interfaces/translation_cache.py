"""Puerto de la caché de traducciones validadas.

[Patrón]: Port (Hexagonal) | [Principio]: DIP (el caso de uso no conoce la implementación LRU en memoria) + ISP (solo get/put).
[Paradigma]: POO estructural (`Protocol`).
"""

from typing import Protocol


class TranslationCachePort(Protocol):
    def get(self, text: str, source: str, target: str = "es") -> str | None: ...

    def put(self, text: str, source: str, translation: str, target: str = "es") -> None: ...
