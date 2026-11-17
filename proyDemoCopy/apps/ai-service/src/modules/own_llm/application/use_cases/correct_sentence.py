"""Caso de uso: corrector pedagógico ÚNICO (Anexo A) — un JSON para el feedback previo al envío, la puntuación y el avatar.

Flujo deterministic-first:
1. Reglas puras de los 7 idiomas (rules/) con la pregunta previa y el origen (voz/escrito).
2. LLM con el prompt versionado del Anexo A → salida validada con Pydantic v2; JSON inválido → UN reintento → modelo base.
3. Los errores del LLM se UBICAN en el texto y solo cubren lo que las reglas no resolvieron (si se solapan, gana la regla).
4. La frase corregida se reconstruye SIEMPRE desde los errores aceptados → nunca hay un error en la lista que no esté aplicado ni al revés.
5. Veredicto y puntuación salen de esa misma lista (100 solo si «correcta»); la traducción es de la frase CORREGIDA.
Sin LLM → solo reglas (`modelo = "reglas"`).
[Patrón]: Use Case + Chain of Responsibility (reglas → modelo propio → reintento → base → reglas) + Port (SentenceTranslator)
[Principio]: SRP + DIP + DRY (una corrección para tres pantallas) | [Paradigma]: POO + funcional (ensamblado puro) + asíncrono.
"""

import json  # stdlib: el modelo recibe la ENTRADA del Anexo A como JSON
import logging
import re
from collections.abc import Sequence
from time import perf_counter  # stdlib: latencia para la trazabilidad (RNF-35)
from typing import Protocol

from pydantic import ValidationError

from src.modules.own_llm.application.schemas.corrector_io import (
    CorrectorError,
    CorrectorInput,
    CorrectorOutput,
    CorrectorResponse,
    TranslationAlternative,
)
from src.modules.own_llm.domain.rules import RuleContext, apply_findings, finalize, plausible, polish, rule_findings, without_overlaps
from src.modules.own_llm.domain.verdict import DEFAULT_COMMENT, FROM_ANNEX, TO_ANNEX, display, score, verdict_of
from src.modules.own_llm.domain.writing_finding import WritingFinding
from src.modules.own_llm.prompts import CORRECTOR_PROMPT, CORRECTOR_PROMPT_VERSION
from src.shared.domain.error_finding import ErrorFinding
from src.shared.domain.text_norm import words
from src.shared.exceptions.custom_errors import ModelInferenceError

logger = logging.getLogger("ai-service.corrector")
RULES_ONLY = "reglas"
_ALT_ORDER = ("natural", "cercana", "literal")  # Orden del Anexo A (la recomendada primero)


class JsonLlm(Protocol):  # [Port]: lo que el caso de uso necesita del cliente de Ollama (los tests inyectan un doble)
    async def generate(self, prompt: str, *, max_tokens: int = ..., temperature: float = ..., system: str | None = ...,
                       model: str | None = ..., json_mode: bool = ..., strict: bool = ...) -> str: ...  # fmt: skip


class SentenceTranslator(Protocol):  # [Port]: traducción al español de la frase corregida (LanguageTools)
    async def translate_line(self, text: str, source: str, context: str = "") -> str | None: ...


class ReferenceLookup(Protocol):  # [Port · Tarea 9]: fragmentos revisados del RAG → [(id, texto citable)] (vacío = sin material)
    async def __call__(self, query: str, language: str, level: str) -> list[tuple[str, str]]: ...


class CorrectSentenceUseCase:
    def __init__(
        self, llm: JsonLlm, chain: Sequence[str], translator: SentenceTranslator | None = None, references: ReferenceLookup | None = None
    ) -> None:
        self._llm = llm  # [DI por constructor]
        self._chain = tuple(dict.fromkeys(m for m in chain if m))  # Sin duplicados ni vacíos, en orden
        self._translator = translator
        self._references = references  # None = sin RAG (tests, codificador no disponible)

    def attempts(self, language: str, own_languages: Sequence[str]) -> tuple[str, ...]:
        """Modelo propio (si se entrenó en el idioma) con UN reintento y después el modelo base. Función pura sobre la cadena."""
        chain = self._chain if language in own_languages else (self._chain[1:] or self._chain)
        return (chain[0], *chain) if chain else ()  # `(a, *b)`: el primero dos veces = reintento

    async def execute(self, req: CorrectorInput, own_languages: Sequence[str] = ("en",)) -> CorrectorResponse:
        started = perf_counter()
        req, used = await self._with_references(req)
        ctx = RuleContext(req.idioma, question=req.pregunta_previa, spoken=req.origen == "voz")
        llm_out, model = await self._ask(req, own_languages)
        out = await self.assemble(req, ctx, llm_out)
        first = self.attempts(req.idioma, own_languages)[:1]
        return CorrectorResponse(
            correccion=out,
            puntuacion=score(out.veredicto, [e.categoria for e in out.errores]),
            modelo=model,
            respaldo=model == RULES_ONLY or (bool(first) and model != first[0]),
            version_prompt=CORRECTOR_PROMPT_VERSION,
            referencias_usadas=used,
            latencia_ms=round((perf_counter() - started) * 1000),
        )

    async def _with_references(self, req: CorrectorInput) -> tuple[CorrectorInput, list[str]]:
        """Regla 11 del Anexo A: si el cliente no mandó «referencias», se piden al RAG (máx. 5) con la frase y la pregunta previa.

        Devuelve la entrada completada y los ids usados (RNF-35). Sin RAG o sin material → la entrada tal cual.
        """
        if req.referencias or self._references is None:
            return req, []
        try:
            found = (await self._references(f"{req.texto} {req.pregunta_previa}".strip(), req.idioma, req.nivel))[:5]
        except Exception as exc:  # noqa: BLE001 — el RAG nunca tumba la corrección
            logger.warning("Corrector sin referencias (%s)", exc)
            return req, []
        if not found:
            return req, []
        # `model_copy(update=...)` (Pydantic v2): copia inmutable con el campo nuevo (el modelo es frozen)
        return req.model_copy(update={"referencias": [text[:1500] for _, text in found]}), [rid for rid, _ in found]

    async def _ask(self, req: CorrectorInput, own_languages: Sequence[str]) -> tuple[CorrectorOutput | None, str]:
        """Pide la salida del Anexo A; JSON inválido o incoherente → siguiente intento. Ninguno → (None, «reglas»)."""
        # La ENTRADA del Anexo A tal cual (JSON); «referencias» es opcional → sin fragmentos no se envía el campo
        prompt = req.model_dump_json(exclude=None if req.referencias else {"referencias"})
        for model in self.attempts(req.idioma, own_languages):
            try:
                raw = await self._llm.generate(prompt, system=CORRECTOR_PROMPT, model=model, json_mode=True, strict=True, temperature=0.1,
                                               max_tokens=min(900, 300 + 3 * len(req.texto)))  # fmt: skip
                return CorrectorOutput.model_validate(json.loads(raw)), model  # `model_validate` (Pydantic v2): valida contra el contrato
            except (ModelInferenceError, ValueError, ValidationError) as exc:  # `json.JSONDecodeError` hereda de ValueError
                logger.warning("Corrector %s: salida no válida (%s)", model, str(exc)[:200])
        return None, RULES_ONLY

    async def assemble(self, req: CorrectorInput, ctx: RuleContext, llm: CorrectorOutput | None) -> CorrectorOutput:
        """Une reglas + errores ubicados del LLM y deriva todo lo demás de esa lista (frase, veredicto, traducción)."""
        text = req.texto.strip()
        proposed = located(text, llm.errores if llm else [], ctx)
        if ctx.language == "en":
            proposed = [f for f in proposed if plausible(text, f)]  # Filtro de inventos del LLM en inglés (rules/english.plausible)
        findings = finalize(text, without_overlaps([rule_findings(text, ctx), proposed]), ctx)  # Las reglas ganan los solapes
        corrected = apply_findings(text, findings)
        errors = [_as_error(text, f) for f in findings]
        if llm and llm.veredicto == "no_responde" and not errors:
            errors = [e for e in llm.errores if e.categoria == "no_responde_a_la_pregunta"][:1]  # Sin corrección mínima posible
        verdict = verdict_of([e.categoria for e in errors if e.categoria != "no_responde_a_la_pregunta"], llm.veredicto if llm else None)
        alternatives = _alternatives(req, llm, corrected)
        translation = await self._translation(req, llm, corrected, alternatives)
        return CorrectorOutput(
            frase_corregida=corrected,
            veredicto=verdict,  # type: ignore[arg-type]  # verdict_of devuelve uno de los tres literales
            errores=errors,
            traduccion=translation,
            alternativas_traduccion=alternatives,
            comentario=(llm.comentario if llm and llm.veredicto == verdict and llm.comentario else DEFAULT_COMMENT[verdict]),
        )

    async def _translation(self, req: CorrectorInput, llm: CorrectorOutput | None, corrected: str, alts: list[TranslationAlternative]) -> str:
        """Traducción de la frase CORREGIDA (regla 7): la del LLM solo si tradujo esa misma frase; si no, LanguageTools."""
        if req.idioma == "es":
            return corrected  # El estudiante practica español: no hay nada que traducir
        if alts:
            return alts[0].texto  # Títulos/expresiones: la recomendada (natural)
        if llm and llm.traduccion and words(llm.frase_corregida) == words(corrected):
            return spanish_marks(llm.traduccion)
        if self._translator:
            return spanish_marks(await self._translator.translate_line(corrected, req.idioma, req.pregunta_previa) or "")  # Con la pregunta como contexto
        return ""


def located(text: str, errors: Sequence[CorrectorError], ctx: RuleContext) -> list[ErrorFinding]:
    """Errores del LLM → hallazgos con posición sobre `text` (los que no aparecen tal cual se descartan). Función pura."""
    out: list[ErrorFinding] = []
    taken: list[tuple[int, int]] = []
    boundary = ctx.language != "zh"  # El chino no separa palabras con espacios
    for e in errors:
        kind = FROM_ANNEX.get(e.categoria)
        if kind is None or not e.original.strip():
            continue  # «no_responde_a_la_pregunta» no corrige un fragmento
        pattern = rf"(?<!\w){re.escape(e.original)}(?!\w)" if boundary else re.escape(e.original)
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            if not any(m.start() < te and ts < m.end() for ts, te in taken):
                taken.append((m.start(), m.end()))
                out.append(WritingFinding(type=kind, original=m.group(), correction=e.sugerencia, start=m.start(), end=m.end(), explanation_es=e.explicacion))
                break
    return out


def _as_error(text: str, f: ErrorFinding) -> CorrectorError:
    original, suggestion = display(text, f)
    return CorrectorError(categoria=TO_ANNEX.get(str(getattr(f.type, "value", f.type)), "gramatica"), original=original,  # type: ignore[arg-type]
                          sugerencia=suggestion, explicacion=f.explanation_es)  # fmt: skip


def _alternatives(req: CorrectorInput, llm: CorrectorOutput | None, corrected: str) -> list[TranslationAlternative]:
    """Regla 8: títulos y expresiones → natural, cercana y literal (en ese orden); frases → lista vacía. Función pura."""
    if req.tipo_de_texto == "frase" or not llm or words(llm.frase_corregida) != words(corrected):
        return []
    by_kind = {a.tipo: a for a in llm.alternativas_traduccion}
    return [by_kind[k] for k in _ALT_ORDER if k in by_kind]


def spanish_marks(text: str) -> str:
    """Traducción con ¿? y ¡! completos y mayúscula/punto (reglas del español). Función pura."""
    return polish(text, "es")
