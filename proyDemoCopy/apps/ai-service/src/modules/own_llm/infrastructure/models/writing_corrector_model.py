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
from typing import cast

from pydantic import ValidationError

from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.own_llm.application.schemas.writing_response import CorrectionDraft
from src.modules.own_llm.domain.correction_diff import MAX_FINDINGS, _classify, diff_findings, explain, explain_caps, explain_es, merge_findings
from src.modules.own_llm.domain.rules import RuleContext, apply_findings, finalize, plausible, rule_findings, without_overlaps
from src.modules.own_llm.domain.writing_finding import WritingErrorType as ErrorType
from src.modules.own_llm.domain.writing_finding import WritingFinding
from src.shared.config.settings import get_settings
from src.modules.own_llm.application.schemas.writing_request import OWN_MODEL_LANGUAGES
from src.shared.domain.error_finding import ErrorFinding
from src.shared.domain.language_detect import detect_language
from src.shared.exceptions.custom_errors import ModelInferenceError

logger = logging.getLogger("ai-service.own-llm")

# Nombre del idioma dentro del prompt (alcance en writing_request.py) | [Patrón]: Lookup Table
LANGUAGE_NAME = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese", "zh": "Mandarin Chinese", "ru": "Russian"}
# [Sin espacios entre palabras]: en chino no hay límites de palabra → el fragmento se busca tal cual
NO_WORD_BOUNDARIES = frozenset({"zh"})

# [Instrucción de sistema]: la misma en servicio, dataset y evaluación → el modelo ajustado ve exactamente lo que aprendió
# [Fix 2026-10-28 · Estilo GrammarMama]: un hallazgo POR error con categoría (incluida «capitalization» = Mayúsculas) y explicación SIEMPRE en español,
# aunque el texto esté en inglés, francés… + ejemplo («i m ana» → «I'm Ana») | ponytail: el modelo propio se ajustó con el prompt anterior → reentrenar con este
SYSTEM_PROMPT = (
    "You are a writing tutor for Spanish-speaking students. Correct the student's text and answer ONLY with JSON: "
    '{"findings": [{"type": one of "spelling", "capitalization", "grammar", "punctuation", "vocabulary", "word_order", "style", '
    '"original": exact fragment copied from the text, "correction": corrected fragment, '
    '"explanation_es": one or two sentences in SPANISH saying WHY it is wrong and the rule that fixes it}], '
    '"corrected_text": the WHOLE text from the first to the last word with every correction applied, never only a part, "explanation_es": one-paragraph summary in Spanish}. '
    "List ONE finding per error (do not merge distant errors). Fix punctuation too: commas between clauses, '?' at the end of questions, "
    "'!', ':', ';' and apostrophes. "
    "Use \"capitalization\" when only upper/lower case changes. "
    "Every explanation_es MUST be written in Spanish (español) even when the student's text is in English or another language. "
    'Example — text "i m ana": {"findings": [{"type": "spelling", "original": "i m", "correction": "I\'m", '
    '"explanation_es": "El pronombre \'I\' siempre se escribe con mayúscula y la contracción de \'I am\' necesita un apóstrofo: \'I\'m\'."}, '
    '{"type": "capitalization", "original": "ana", "correction": "Ana", '
    '"explanation_es": "Los nombres propios se escriben con mayúscula inicial."}], "corrected_text": "I\'m Ana", '
    '"explanation_es": "Revisa las mayúsculas y las contracciones."}. '
    'Example — text "i m dance": {"findings": [{"type": "capitalization", "original": "i", "correction": "I", '
    '"explanation_es": "En inglés, el pronombre personal \'I\' se escribe siempre con mayúscula."}, '
    '{"type": "spelling", "original": "m", "correction": "\'m", '
    '"explanation_es": "La contracción de \'I am\' es \'I\'m\', con apóstrofo. Escribir solo \'m\' es propio de mensajes informales y no es correcto."}, '
    '{"type": "grammar", "original": "dance", "correction": "dancing.", '
    '"explanation_es": "Para una acción que ocurre ahora se usa el presente continuo (am + verbo con -ing). \'I am dance\' no es gramatical. Además, falta el punto final."}], '
    '"corrected_text": "I\'m dancing.", "explanation_es": "Revisa la contracción y el tiempo verbal."}. '
    "Mark only real errors for the given CEFR level; if the text is correct return an empty findings list. "
    # [Bug 2026-10-19]: con inglés elegido, «helo» se «corregía» a «hola» → la corrección SIEMPRE en el idioma indicado; solo las explicaciones van en español
    "The student writes in the given Language: every 'correction' and the 'corrected_text' MUST stay in that Language "
    "(fix the spelling, e.g. English 'helo' -> 'hello'); NEVER translate the student's text into Spanish."
)


def build_prompt(text: str, language: str, level: str, context: str | None = None) -> str:
    """Prompt de usuario (función pura) | [Principio]: DRY — lo importan training/ y tests/evaluation/."""
    name = LANGUAGE_NAME.get(language, language)
    # [2026-11-11 · «my niece is Laura» ante «What's your name?»]: con la pregunta del diálogo, lo que no encaja también se corrige
    ctx = (
        f'The student is answering this question in a conversation: "{context}". If a word does not fit the meaning of the answer '
        "(often a speech-recognition mistake, e.g. 'my niece is Laura' instead of 'my name is Laura'), correct it as \"vocabulary\".\n"
        if context
        else ""
    )
    return f"Language: {name}\nCEFR level: {level}\n{ctx}Student text ({name}; keep the correction in {name}):\n{text}"


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


_MIN_NOT_SPANISH = 0.6  # Confianza mínima para decidir que una explicación NO está en español (evita falsos positivos en frases cortas)
# [Fix 2026-11-03]: el LLM copia el ejemplo inglés del prompt («la contracción de 'I am'…») aunque el texto sea francés → explicación de otro idioma
_MENTIONS_ENGLISH = re.compile(r"\bingl[eé]s\b|['‘’«\"]I['’»\"]|\bI am\b|\bI'm\b")  # Sin IGNORECASE: «si amas» no es «I am»


def ensure_spanish(findings: Sequence[ErrorFinding], text: str, language: str = "en") -> list[ErrorFinding]:
    """[Fix 2026-10-28]: la explicación de cada hallazgo SIEMPRE en español → si el LLM la escribió en otro idioma se sustituye por la genérica.

    [Principio]: Fail Safe (determinista, sin otra llamada al LLM) | [Paradigma]: Funcional — `model_copy` devuelve un VO nuevo.
    """
    out: list[ErrorFinding] = []
    for f in findings:
        # [Fix 2026-10-30]: en mayúsculas la regla la decide el servidor por posición → el LLM mezclaba idiomas («Les pronoms propres siempre…») y confundía el motivo
        if f.type == ErrorType.CAPITALIZATION and f.start is not None and f.original.casefold() == f.correction.casefold():  # Solo mayúsculas (no «ana → Ana.»)
            out.append(f.model_copy(update={"explanation_es": explain_caps(text, f.start, f.correction)}))
            continue
        # [Fix 2026-11-03 · «je sui → Je suis» como «Mayúsculas»]: si cambian letras no es solo mayúscula → se reclasifica y se explica por regla
        # (salvo «ana → Ana.»: mayúscula + punto final, que ya trae su explicación)
        if f.type == ErrorType.CAPITALIZATION and f.start is not None and f.original.casefold() != f.correction.rstrip(".").casefold():
            kind = _classify(f.original, f.correction)
            out.append(f.model_copy(update={"type": kind, "explanation_es": explain(kind, text, f.start, f.original, f.correction)}))
            continue
        d = detect_language(f.explanation_es)
        foreign = d.language != "es" and d.method != "default" and d.confidence >= _MIN_NOT_SPANISH
        wrong_lang = language != "en" and _MENTIONS_ENGLISH.search(f.explanation_es) is not None
        if (foreign or wrong_lang) and f.start is not None:
            out.append(f.model_copy(update={"explanation_es": explain(ErrorType(f.type), text, f.start, f.original, f.correction)}))
        else:
            out.append(f.model_copy(update={"explanation_es": explain_es(f)}) if foreign else f)
    return out


_MIN_COVERAGE = 0.6  # Un «texto corregido» más corto que esto respecto al original es un fragmento, no el texto entero


def complete_corrected(text: str, corrected: str, findings: Sequence[ErrorFinding]) -> str:
    """[Fix 2026-10-30]: el modelo a veces devuelve solo la parte que corrigió → se reconstruye el texto entero aplicando los hallazgos ubicados.

    [Principio]: Fail Safe + determinístico | [Paradigma]: función pura | Se aplican de atrás hacia delante para no desplazar las posiciones.
    """
    if len(corrected.strip()) >= len(text.strip()) * _MIN_COVERAGE:
        return corrected
    out = text
    for f in sorted((f for f in findings if f.start is not None and f.end is not None), key=lambda f: f.start or 0, reverse=True):
        out = f"{out[: f.start]}{f.correction}{out[f.end :]}"
    return out


def parse_draft(raw: str, text: str, language: str = "en", ctx: RuleContext | None = None) -> CorrectionDraft:
    """JSON del modelo → CorrectionDraft validado y con posiciones. Lanza ValueError si no cumple el contrato.

    [2026-11-13 · deterministic-first en los 7 idiomas]: las reglas (rules/) ganan a lo que se solape del LLM y el texto corregido
    se rehace SIEMPRE desde los hallazgos (así cuadra con la lista). `ctx`: pregunta previa y origen (voz/escrito)."""
    ctx = ctx or RuleContext(language)
    try:
        draft = CorrectionDraft.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"Salida no válida: {exc}") from exc
    located = locate_findings(text, draft.findings, language not in NO_WORD_BOUNDARIES)
    # [Diff · 2026-10-27]: lo que el modelo corrigió en `corrected_text` pero no listó (comas, mayúsculas…) también se subraya
    # ponytail: el diff por tokens no aplica al chino (sin espacios: un «token» sería la frase entera)
    corrected = complete_corrected(text, draft.corrected_text, located)
    extra = [] if language in NO_WORD_BOUNDARIES else diff_findings(text, corrected)
    findings = ensure_spanish(merge_findings(located, extra), text, language)
    # [2026-11-10]: en inglés, UN hallazgo del LLM que empeora la frase (ver rules/english.plausible) = su corrección entera no es fiable
    # (el diff de esa frase arrastra «name → Name», «am → Am»…) → solo quedan las reglas deterministas
    if language == "en" and not all(plausible(text, f) for f in [*located, *findings]):
        findings = []
    final = finalize(text, without_overlaps([rule_findings(text, ctx), findings]), ctx)[:MAX_FINDINGS]  # Reglas primero: ganan los solapes
    if language in NO_WORD_BOUNDARIES:  # Chino: los hallazgos no cubren todo lo que el modelo corrigió → se conserva su texto + signo final
        return draft.model_copy(update={"corrected_text": corrected + _zh_mark(corrected, final), "findings": final})
    return draft.model_copy(update={"corrected_text": apply_findings(text, final), "findings": final})


def _zh_mark(corrected: str, final: Sequence[ErrorFinding]) -> str:
    """Signo final que las reglas añadieron en chino («。»/«？») si el texto del modelo aún no lo tiene. Función pura."""
    added = next((f.correction[-1] for f in final if f.correction[-1:] in "。？"), "")  # `next(gen, default)`: primer signo añadido
    return "" if corrected.rstrip()[-1:] in "。？！.?!" else added


def rules_only_draft(text: str, ctx: RuleContext) -> CorrectionDraft | None:
    """[2026-11-02 → 2026-11-13]: Ollama caído → en CUALQUIERA de los 7 idiomas se devuelven al menos los errores de las reglas (None si no hay)."""
    findings = finalize(text, rule_findings(text, ctx), ctx)
    if not findings:
        return None
    # `cast` (typing): las reglas solo crean WritingFinding; el tipo base viene de la firma común con los hallazgos del LLM
    return CorrectionDraft(findings=cast(list[WritingFinding], findings), corrected_text=apply_findings(text, findings), explanation_es="Corrección básica por reglas (la IA no está disponible ahora).")


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

    async def correct(self, text: str, language: str, level: str, context: str | None = None, spoken: bool = False) -> tuple[CorrectionDraft, str]:
        """Devuelve (corrección, modelo que respondió). Lanza ModelInferenceError (503) si ningún modelo responde bien."""
        prompt = build_prompt(text, language, level, context)
        ctx = RuleContext(language, question=context or "", spoken=spoken)  # [Anexo A]: pregunta previa + origen voz/escrito
        for model in self.chain_for(language):
            try:
                raw = await self._llm.generate(
                    prompt, system=SYSTEM_PROMPT, model=model, json_mode=True, strict=True, temperature=0.1,
                    max_tokens=min(1024, 256 + 2 * len(text)),  # [2026-11-10]: frase corta = respuesta corta (en CPU cada token cuesta; 1024 fijo → >1 min)
                )
                return parse_draft(raw, text, language, ctx), model
            except (ModelInferenceError, ValueError) as exc:  # [Fallback]: modelo ausente, caído o con JSON inválido → siguiente eslabón
                logger.warning("Corrector %s falló (%s); probando el siguiente", model, exc)
        if draft := rules_only_draft(text, ctx):  # [Fail Soft]: sin IA, al menos las reglas (los 7 idiomas)
            return draft, "reglas"
        raise ModelInferenceError("Ningún modelo pudo corregir la redacción en este momento")


@lru_cache(maxsize=1)  # [Singleton]: una instancia por proceso | [Patrón]: Lazy Singleton
def get_writing_corrector() -> WritingCorrectorModel:
    s = get_settings()
    return WritingCorrectorModel(OllamaClient(timeout=s.own_llm_timeout_s), (s.ollama_corrector_model, s.ollama_model))
