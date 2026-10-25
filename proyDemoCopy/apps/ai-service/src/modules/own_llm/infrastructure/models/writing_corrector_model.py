"""WritingCorrectorModel — corrector de redacciones con el LLM propio y respaldo al modelo base.

[Patrón]: Strategy (un modelo de Ollama por eslabón) + Chain of Responsibility / Fallback (aula-corrector → modelo base).
[Principio]: OCP — un modelo nuevo = un nombre más en la cadena; DRY — prompt único para servir, entrenar y evaluar.
[Paradigma]: POO + funcional (parseo y ubicación son funciones puras) + asíncrono.
[Tecnología]: Ollama vía el OllamaClient compartido del servicio (un solo cliente HTTP por servicio).
"""

import json  # stdlib: parseo de la salida JSON del modelo
import logging
import re  # stdlib: búsqueda del fragmento con límites de palabra
from collections.abc import Sequence
from functools import lru_cache

from pydantic import ValidationError

from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.own_llm.application.schemas.writing_response import CorrectionDraft
from src.shared.config.settings import get_settings
from src.modules.own_llm.application.schemas.writing_request import OWN_MODEL_LANGUAGES
from src.shared.domain.error_finding import ErrorFinding
from src.shared.exceptions.custom_errors import ModelInferenceError

logger = logging.getLogger("ai-service.own-llm")

# Nombre del idioma dentro del prompt (alcance en writing_request.py) | [Patrón]: Lookup Table
LANGUAGE_NAME = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese", "zh": "Mandarin Chinese", "ru": "Russian"}
# [Sin espacios entre palabras]: en chino no hay límites de palabra → el fragmento se busca tal cual
NO_WORD_BOUNDARIES = frozenset({"zh"})

# [Instrucción de sistema]: la misma en servicio, dataset y evaluación → el modelo ajustado ve exactamente lo que aprendió
SYSTEM_PROMPT = (
    "You are a writing tutor for Spanish-speaking students. Correct the student's text and answer ONLY with JSON: "
    '{"findings": [{"type": one of "grammar", "vocabulary", "spelling", "punctuation", "word_order", "style", '
    '"original": exact fragment copied from the text, "correction": corrected fragment, '
    '"explanation_es": short explanation in Spanish}], '
    '"corrected_text": the full corrected text, "explanation_es": one-paragraph summary in Spanish}. '
    "Mark only real errors for the given CEFR level; if the text is correct return an empty findings list. "
    # [Bug 2026-10-19]: con inglés elegido, «helo» se «corregía» a «hola» → la corrección SIEMPRE en el idioma indicado; solo las explicaciones van en español
    "The student writes in the given Language: every 'correction' and the 'corrected_text' MUST stay in that Language "
    "(fix the spelling, e.g. English 'helo' -> 'hello'); NEVER translate the student's text into Spanish."
)


def build_prompt(text: str, language: str, level: str) -> str:
    """Prompt de usuario (función pura) | [Principio]: DRY — lo importan training/ y tests/evaluation/."""
    name = LANGUAGE_NAME.get(language, language)
    return f"Language: {name}\nCEFR level: {level}\nStudent text ({name}; keep the correction in {name}):\n{text}"


def _fragment_pattern(fragment: str, word_boundaries: bool = True) -> re.Pattern[str]:
    """Regex del fragmento con límites de palabra en los extremos alfanuméricos ("a" no casa dentro de "apple")."""
    head = r"(?<!\w)" if word_boundaries and fragment[0].isalnum() else ""  # `(?<!\w)` (regex lookbehind): no precedido por letra o dígito
    tail = r"(?!\w)" if word_boundaries and fragment[-1].isalnum() else ""  # `(?!\w)` (regex lookahead): no seguido por letra o dígito
    return re.compile(head + re.escape(fragment) + tail)


def locate_findings(text: str, findings: Sequence[ErrorFinding], word_boundaries: bool = True) -> list[ErrorFinding]:
    """Calcula start/end de cada hallazgo buscando el fragmento en el texto (en orden).

    Descarta hallazgos cuyo fragmento no aparece (alucinados) o que no cambian nada.
    [Paradigma]: Funcional — no muta la entrada; `model_copy(update=…)` devuelve un VO nuevo.
    """
    located: list[ErrorFinding] = []
    cursor = 0  # Busca a partir del hallazgo anterior → dos errores iguales se ubican en sitios distintos
    for f in findings:
        if f.original.strip() == f.correction.strip():
            continue
        pattern = _fragment_pattern(f.original, word_boundaries)
        match = pattern.search(text, cursor) or pattern.search(text)  # El modelo puede listar los errores desordenados
        if match is None:
            continue
        located.append(f.model_copy(update={"start": match.start(), "end": match.end()}))
        cursor = match.end()
    return sorted(located, key=lambda f: f.start or 0)


def parse_draft(raw: str, text: str, language: str = "en") -> CorrectionDraft:
    """JSON del modelo → CorrectionDraft validado y con posiciones. Lanza ValueError si no cumple el contrato."""
    try:
        draft = CorrectionDraft.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"Salida no válida: {exc}") from exc
    return draft.model_copy(update={"findings": locate_findings(text, draft.findings, language not in NO_WORD_BOUNDARIES)})


class WritingCorrectorModel:
    """Recorre la cadena de modelos hasta obtener una corrección válida."""

    name = "writing_corrector"

    def __init__(self, llm: OllamaClient, chain: Sequence[str]) -> None:
        self._llm = llm  # [DI por constructor]: en tests se inyecta un doble
        self._chain = tuple(dict.fromkeys(m for m in chain if m))  # `dict.fromkeys` (stdlib): quita duplicados sin perder el orden

    @property
    def chain(self) -> tuple[str, ...]:
        return self._chain

    def chain_for(self, language: str) -> tuple[str, ...]:
        """Cadena para un idioma: el modelo propio solo donde se entrenó; en los demás empieza el modelo base. [Patrón]: Strategy por idioma."""
        return self._chain if language in OWN_MODEL_LANGUAGES else self._chain[1:] or self._chain

    @property
    def llm(self) -> OllamaClient:  # La ficha del modelo reutiliza el mismo cliente HTTP | [Principio]: DRY
        return self._llm

    async def correct(self, text: str, language: str, level: str) -> tuple[CorrectionDraft, str]:
        """Devuelve (corrección, modelo que respondió). Lanza ModelInferenceError (503) si ningún modelo responde bien."""
        prompt = build_prompt(text, language, level)
        for model in self.chain_for(language):
            try:
                raw = await self._llm.generate(
                    prompt, system=SYSTEM_PROMPT, model=model, json_mode=True, strict=True, temperature=0.1, max_tokens=1024
                )
                return parse_draft(raw, text, language), model
            except (ModelInferenceError, ValueError) as exc:  # [Fallback]: modelo ausente, caído o con JSON inválido → siguiente eslabón
                logger.warning("Corrector %s falló (%s); probando el siguiente", model, exc)
        raise ModelInferenceError("Ningún modelo pudo corregir la redacción en este momento")


@lru_cache(maxsize=1)  # [Singleton]: una instancia por proceso | [Patrón]: Lazy Singleton
def get_writing_corrector() -> WritingCorrectorModel:
    s = get_settings()
    return WritingCorrectorModel(OllamaClient(timeout=s.own_llm_timeout_s), (s.ollama_corrector_model, s.ollama_model))
