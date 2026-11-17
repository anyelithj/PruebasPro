"""Value Object LanguageUsage — cuánto escribe el alumno en el idioma que estudia (2026-10-28).

[Patrón]: Value Object inmutable + Table-Driven (meta por nivel MCER en una tabla) + Shared Kernel (lo usan el TutorAgent y el endpoint /language-usage).
[Principio]: SSOT (la meta por nivel vive SOLO aquí; NestJS y Angular muestran lo que devuelve FastAPI) + OCP (nivel nuevo = una fila) + determinístico (sin LLM, < 1 ms).
[Paradigma]: Funcional (funciones puras, sin E/S) + POO (`dataclass(frozen=True)`).

[Regla]: solo cuentan los mensajes del alumno POSTERIORES al aviso del tutor «A partir de tu próximo mensaje, escríbeme en …» → el primer mensaje
(el tema que elige, normalmente en español) no penaliza. La proporción es por PALABRAS: cada fragmento (oración, cláusula o cita) se detecta con
`detect_language` (shared/domain) y sus palabras suman al idioma meta solo si el detector lo reconoce con evidencia (no por el idioma por defecto).
"""

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Protocol

from src.shared.domain.language_detect import detect_language
from src.shared.domain.text_norm import words

# [Meta mínima por nivel MCER]: fracción de palabras del alumno que deben ir en el idioma meta | `MappingProxyType` (stdlib): tabla de solo lectura
# A1 30 % · A2 40 % · B1 60 % · B2 75 % · C1 90 % · C2 100 % | [Principio]: OCP — ajustar la política = cambiar una fila
TARGET_SHARE_BY_LEVEL: Mapping[str, float] = MappingProxyType(
    {"A1": 0.30, "A2": 0.40, "B1": 0.60, "B2": 0.75, "C1": 0.90, "C2": 1.00}
)
DEFAULT_LEVEL = "B1"  # Sin nivel declarado → intermedio (misma regla que la política de idioma del tutor)

# [Aviso de cambio de idioma]: frase que el tutor añade UNA vez; desde ahí empieza la medición | `re.I`: sin distinguir mayúsculas
# Acepta también la variante que a veces redacta el LLM («Desde tu próxima respuesta…») → no se anuncia dos veces
SWITCH_ANNOUNCED = re.compile(r"(a partir de|desde) tu pr[oó]xim[oa] (mensaje|respuesta)", re.I)
# [Petición de reformular]: el tutor ya pidió reescribir en el idioma meta → no se añade dos veces
REPHRASE_ASKED = re.compile(r"reescr[ií]b|rephrase|reformul", re.I)

# [Fragmentos]: oración/cláusula separada por signos o por comillas tipográficas | `'…'` solo si no está pegado a letras («don't» no se corta)
_SPLIT = re.compile(r"[.!?¿¡;:,\n()«»\"“”]+|(?<!\w)'|'(?!\w)")


class _Turn(Protocol):
    """Cualquier mensaje con `role` y `content` (Message del dominio o HistoryTurn de Pydantic) | [Principio]: ISP (duck typing tipado)."""

    role: str
    content: str


@dataclass(frozen=True, slots=True)
class TurnUsage:
    """Palabras de UN mensaje y cuántas están en el idioma meta."""

    words: int
    target_words: int

    @property
    def share(self) -> float:
        return self.target_words / self.words if self.words else 0.0


@dataclass(frozen=True, slots=True)
class LanguageUsage:
    """Uso del idioma meta en la conversación (solo turnos posteriores al aviso)."""

    language: str
    level: str
    target: float  # Meta del nivel (0–1)
    words: int
    target_words: int
    turns: int  # Mensajes del alumno que ya cuentan
    announced: bool  # ¿El tutor ya dijo cuándo cambiar de idioma?

    @property
    def ratio(self) -> float:
        return self.target_words / self.words if self.words else 0.0

    @property
    def below(self) -> bool:
        # `1e-9`: tolerancia de coma flotante (100 % de 100 % no debe salir «por debajo»)
        return self.turns > 0 and self.ratio + 1e-9 < self.target

    def to_dict(self) -> dict[str, object]:
        """Forma JSON (snake_case) que viaja a NestJS → UI «Uso del idioma: 45 % / meta 60 %»."""
        return {
            "language": self.language,
            "level": self.level,
            "ratio": round(self.ratio, 3),
            "target": self.target,
            "words": self.words,
            "target_words": self.target_words,
            "turns": self.turns,
            "announced": self.announced,
            "below": self.below,
        }


def target_share(level: str | None) -> float:
    """Meta del nivel (sin nivel o desconocido → B1). [Paradigma]: función pura."""
    return TARGET_SHARE_BY_LEVEL.get((level or DEFAULT_LEVEL).upper(), TARGET_SHARE_BY_LEVEL[DEFAULT_LEVEL])


def measure_turn(text: str, language: str) -> TurnUsage:
    """Palabras del mensaje y cuántas pertenecen a fragmentos detectados en `language`. [Patrón]: Map/Reduce sobre fragmentos."""
    total = target = 0
    for segment in _SPLIT.split(text):
        n = len(words(segment))
        if not n:
            continue
        total += n
        det = detect_language(segment)
        # `method != "default"`: sin evidencia el detector responde «en» por defecto → no debe regalar puntos al inglés
        if det.language == language and det.method != "default":
            target += n
    return TurnUsage(total, target)


def measure_conversation(messages: Iterable[_Turn], language: str, level: str | None) -> LanguageUsage:
    """Uso acumulado del idioma meta en los mensajes del alumno posteriores al aviso del tutor. [Paradigma]: función pura (un recorrido)."""
    announced = False
    total = target = turns = 0
    for m in messages:
        if m.role == "assistant":
            announced = announced or bool(SWITCH_ANNOUNCED.search(m.content))
        elif m.role == "user" and announced:
            t = measure_turn(m.content, language)
            if t.words:
                total, target, turns = total + t.words, target + t.target_words, turns + 1
    lvl = (level or DEFAULT_LEVEL).upper()
    return LanguageUsage(language, lvl, target_share(lvl), total, target, turns, announced)
