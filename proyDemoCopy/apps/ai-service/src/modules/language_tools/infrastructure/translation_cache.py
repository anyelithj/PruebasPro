"""Caché en memoria de traducciones validadas (frases repetidas en diálogos y canciones → sin otra llamada al LLM).

[Patrón]: Cache-Aside + LRU (Least Recently Used) acotado.
[Principio]: SRP + rendimiento (Ollama en CPU tarda segundos por frase) — solo se guardan traducciones que pasaron el control de calidad.
[Paradigma]: POO.
ponytail: por proceso (un worker de uvicorn); NestJS ya cachea en BD lo que persiste. Redis si se escala a varios workers.
"""

from collections import OrderedDict

from src.shared.domain.text_norm import norm


class TranslationCache:
    def __init__(self, max_items: int = 2000) -> None:
        # `OrderedDict` (stdlib): conserva el orden de uso → `popitem(last=False)` expulsa la entrada más antigua (LRU)
        self._items: OrderedDict[tuple[str, str, str], str] = OrderedDict()
        self._max = max_items

    @staticmethod
    def _key(text: str, source: str, target: str) -> tuple[str, str, str]:
        return source, target, norm(text)  # Normalizada: «Yes!» y «yes!» comparten entrada; los signos se conservan

    def get(self, text: str, source: str, target: str = "es") -> str | None:
        key = self._key(text, source, target)
        hit = self._items.get(key)
        if hit is not None:
            self._items.move_to_end(key)  # `move_to_end`: marca la entrada como usada recientemente
        return hit

    def put(self, text: str, source: str, translation: str, target: str = "es") -> None:
        self._items[self._key(text, source, target)] = translation
        self._items.move_to_end(self._key(text, source, target))
        while len(self._items) > self._max:
            self._items.popitem(last=False)
