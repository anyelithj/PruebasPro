"""Puerto del fonetizador (texto → IPA).

[Patrón]: Port (Hexagonal) — los casos de uso no conocen espeak-ng; otro motor = otro adaptador.
[Principio]: DIP + ISP (dos métodos: por palabra y completo).
[Paradigma]: POO estructural (`Protocol`, sin herencia).
[Regla del producto · Sprint 8.1]: el IPA lo produce un fonetizador DETERMINISTA, nunca el LLM (inventa símbolos).
"""

from typing import Protocol


class Phonetizer(Protocol):
    """Contrato: texto + voz → IPA."""

    engine: str  # Motor y versión fija (p. ej. "espeak-ng 1.52.0") → la salida cambia entre versiones, se guarda con el resultado

    async def ipa(self, text: str, voice: str) -> str: ...  # IPA del texto completo (con enlaces entre palabras)

    async def ipa_words(self, words: list[str], voice: str) -> list[str]: ...  # IPA de cada palabra, en el mismo orden
