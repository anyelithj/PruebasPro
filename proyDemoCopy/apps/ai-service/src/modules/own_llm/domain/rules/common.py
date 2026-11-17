"""Reglas deterministas comunes a los 7 idiomas: mayúscula inicial y signo final (punto o interrogación).

[2026-11-13 · Anexo A regla 6]: «Toda oración empieza con mayúscula y termina con signo final» → antes solo se aplicaba al inglés.
El chino no distingue mayúsculas y usa signos de ancho completo (。？).
[Patrón]: Rule Engine mínimo (tablas por idioma + funciones puras) | [Principio]: determinístico primero + OCP (un idioma = una entrada más)
[Paradigma]: Funcional (sin E/S ni estado).
"""

import re  # stdlib: expresiones regulares
from collections.abc import Mapping, Sequence  # stdlib: tipos abstractos de solo lectura
from types import MappingProxyType  # stdlib: diccionario de solo lectura

from src.modules.own_llm.domain.rules.context import RuleContext
from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
from src.modules.own_llm.domain.writing_finding import WritingFinding as F
from src.shared.domain.error_finding import ErrorFinding  # Tipo base: también llegan hallazgos del LLM y del diff (Liskov)

# [WORD]: palabra en cualquier alfabeto (latino con tildes, cirílico, CJK) + contracción con apóstrofo | `[^\W\d_]` = letra Unicode
WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)?")
UNCASED = frozenset({"zh"})  # Escrituras sin mayúsculas
FINAL_MARKS = ".!?…。？！"  # Cualquiera de estos cierra la oración
CAPITAL_START = "La primera palabra de la oración se escribe con mayúscula inicial."

# [Palabras que abren una pregunta]: solo formas inequívocas (en español y portugués «como» también es «yo como» → se excluye)
# `MappingProxyType` (stdlib): tabla inmutable compartida | [Patrón]: Lookup Table por idioma
QUESTION_START: Mapping[str, frozenset[str]] = MappingProxyType({
    "en": frozenset("what where when who whom whose why which how do does did is are am was were can could will would should shall may might have has".split()),
    "es": frozenset("qué cómo dónde cuándo quién quiénes cuál cuáles cuánto cuánta cuántos cuántas adónde".split()),
    "fr": frozenset("qu'est-ce est-ce comment où quand pourquoi quel quelle quels quelles combien".split()),
    "de": frozenset("wer was wo wann warum wie welche welcher welches woher wohin wieso".split()),
    "pt": frozenset("onde quando quem qual quais quanto quanta quantos quantas".split()),
    "ru": frozenset("что где когда кто почему как какой какая какие сколько зачем откуда куда".split()),
})  # fmt: skip
ZH_QUESTION = ("吗", "呢", "什么", "谁", "哪", "怎么", "为什么", "几", "多少")  # Partículas y pronombres interrogativos del chino


def apply_findings(text: str, findings: Sequence[ErrorFinding]) -> str:
    """Texto con cada hallazgo ubicado sustituido (de atrás hacia delante para no desplazar posiciones). Función pura."""
    out = text
    for f in sorted((f for f in findings if f.start is not None and f.end is not None), key=lambda f: f.start or 0, reverse=True):
        out = f"{out[: f.start]}{f.correction}{out[f.end :]}"  # f-string (PEP 498) + slicing: reemplaza [start, end)
    return out


def is_question(text: str, language: str) -> bool:
    """¿La oración es una pregunta por su primera palabra (o por sus partículas en chino)? Función pura."""
    if language == "zh":
        return any(q in text for q in ZH_QUESTION)
    words = [w.lower() for w in WORD.findall(text)]
    return bool(words) and (words[0] in QUESTION_START.get(language, frozenset()) or " ".join(words[:2]) in ("por qué", "o que", "por que"))


def capital_start(text: str, ctx: RuleContext) -> list[F]:
    """Primera letra de cada oración en minúscula → mayúscula (no aplica al chino). Función pura."""
    if ctx.language in UNCASED:
        return []
    out: list[F] = []
    for m in WORD.finditer(text):
        w = m.group()
        before = text[: m.start()].rstrip(" ¿¡\"'«(")  # Ignora los signos de apertura (¿Cómo… / «hola…)
        if w[0].islower() and (not before or before[-1] in ".!?…"):
            out.append(F(type=T.CAPITALIZATION, original=w, correction=w[0].upper() + w[1:], start=m.start(), end=m.end(), explanation_es=CAPITAL_START))
    return out


def final_mark(text: str, findings: Sequence[ErrorFinding], ctx: RuleContext) -> list[ErrorFinding]:
    """Falta el signo final → se suma al hallazgo de la última palabra o se crea uno («?» si es pregunta). Función pura."""
    body = text.rstrip()
    zh = ctx.language == "zh"
    last = list(WORD.finditer(body))
    if not body or (len(body) < 2 if zh else len(last) < 2) or body[-1] in FINAL_MARKS:  # Una sola palabra («Yes») no exige punto
        return list(findings)
    if apply_findings(text, findings).rstrip()[-1:] in FINAL_MARKS:  # Ya lo añadió otro hallazgo
        return list(findings)
    ask = is_question(body, ctx.language)
    mark = ("？" if ask else "。") if zh else ("?" if ask else ".")
    why = "La pregunta debe terminar con un signo de interrogación." if ask else "La oración debe terminar con un punto."
    end = len(body)
    tail = last[-1] if last else None
    for i, f in enumerate(findings):
        if f.end == end:  # El último fragmento ya tiene un hallazgo → se le añade el signo (un error = un hallazgo)
            merged = f.model_copy(update={"correction": f.correction + mark, "explanation_es": f"{f.explanation_es} Además, {why[0].lower()}{why[1:]}"})
            return [*findings[:i], merged, *findings[i + 1 :]]  # `*` (PEP 448): lista nueva sin mutar la original
    start = tail.start() if tail and tail.end() == end else end - 1  # Chino: último carácter
    original = body[start:end]
    return [*findings, F(type=T.PUNCTUATION, original=original, correction=original + mark, start=start, end=end, explanation_es=why)]


def without_overlaps(groups: Sequence[Sequence[ErrorFinding]]) -> list[ErrorFinding]:
    """Une hallazgos por prioridad (el primero gana si se solapan) y los ordena por posición. Función pura."""
    taken: list[tuple[int, int]] = []
    out: list[ErrorFinding] = []
    for f in (f for g in groups for f in g):  # Generador aplanado: respeta el orden de prioridad
        s, e = f.start or 0, f.end or 0
        if any(s < te and ts < e for ts, te in taken):  # Intervalos semiabiertos [s, e)
            continue
        taken.append((s, e))
        out.append(f)
    return sorted(out, key=lambda f: f.start or 0)
