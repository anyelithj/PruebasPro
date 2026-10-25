"""Caso de uso: pronunciar un texto con la voz de su idioma y variante.

[Patrón]: Use Case (Command) + Port (SpeechSynthesizer).
[Principio]: SRP + DIP — no conoce espeak-ng ni HTTP.
[Paradigma]: POO + asíncrono.
[Nota]: la caché vive en el backend (MinIO); aquí solo se genera cuando el backend lo pide (Cache-Aside).
"""

from dataclasses import dataclass

from src.modules.language_tools.application.schemas.speak_request import SpeakRequest
from src.modules.language_tools.domain.interfaces.speech_synthesizer import (
    SpeechSynthesizer,
)
from src.modules.language_tools.domain.language_voices import voice_for


@dataclass(frozen=True)  # `dataclass(frozen=True)` (stdlib): resultado inmutable
class SpeechResult:
    audio: bytes  # WAV
    variant: str  # Variante usada (la pedida o la del idioma)
    voice: str  # Voz de espeak-ng
    engine: str


class SynthesizeSpeechUseCase:
    def __init__(self, synthesizer: SpeechSynthesizer) -> None:
        self._synth = (
            synthesizer  # [DI por constructor]: el router inyecta el adaptador
        )

    async def execute(self, req: SpeakRequest) -> SpeechResult:
        variant, voice = voice_for(
            req.language, req.variant
        )  # 422 si la variante no corresponde al idioma
        audio = await self._synth.synthesize(req.text.strip(), voice)
        return SpeechResult(
            audio=audio, variant=variant, voice=voice, engine=self._synth.engine
        )
