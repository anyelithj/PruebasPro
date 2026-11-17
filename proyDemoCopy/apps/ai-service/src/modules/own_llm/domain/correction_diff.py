"""Hallazgos a partir del diff «texto original ↔ texto corregido» (complementa los que lista el LLM).

[Patrón]: Diff (Ratcliff/Obershelp de `difflib.SequenceMatcher`) + Merge (los hallazgos del LLM ganan; el diff rellena huecos).
[Principio]: determinístico primero (las posiciones las calcula el servidor, nunca el LLM) + Fail Safe (corrección «desbocada» → sin diff).
[Paradigma]: Funcional (funciones puras, sin E/S).
[2026-10-27 · Corrector estilo GrammarMama]: los modelos pequeños corrigen en `corrected_text` cosas que olvidan listar en `findings`
(comas, mayúsculas, tildes) → sin esto el editor no podría subrayarlas ni ofrecer «Aceptar».
"""

import re
import unicodedata  # stdlib: quitar tildes para detectar «so» → «só»
from collections.abc import Sequence
from difflib import SequenceMatcher  # stdlib: opcodes equal/replace/delete/insert entre dos secuencias

from src.modules.own_llm.domain.writing_finding import WritingErrorType as ErrorType  # [2026-10-28]: incluye «capitalization» (alias → mismo código abajo)
from src.modules.own_llm.domain.writing_finding import WritingFinding as ErrorFinding

# [Tokens]: palabras (con apóstrofo o guion internos: «don't», «well-known») o un signo suelto; los espacios no cuentan
_TOKEN = re.compile(r"\w+(?:['’-]\w+)*|[^\w\s]")
_PUNCT = re.compile(r"^[^\w\s]+$")
_MIN_SIMILARITY = 0.5  # Debajo: el modelo reescribió (o tradujo) el texto → el diff marcaría todo y no ayuda
_MAX_FRAGMENT = 300  # Igual que ErrorFinding.original (max_length)
MAX_FINDINGS = 40  # Igual que CorrectionDraft.findings (max_length)

# [Explicación genérica por tipo]: el diff sabe QUÉ cambió, no POR QUÉ → texto pedagógico breve y honesto
# [2026-10-28]: Mayúsculas separada de Puntuación (como GrammarMama) · SIEMPRE en español, sea cual sea el idioma del texto
_EXPLANATION = {
    # [Fix 2026-11-03]: sin «pronombre inglés I» → salía también en francés/alemán/portugués
    ErrorType.CAPITALIZATION: "Mayúsculas: se escribe «{c}».",
    ErrorType.PUNCTUATION: "Puntuación: «{o}» → «{c}».",
    ErrorType.SPELLING: "Ortografía: se escribe «{c}».",
    ErrorType.WORD_ORDER: "Orden de las palabras: «{c}».",
    ErrorType.GRAMMAR: "Gramática: se escribe «{c}» en lugar de «{o}».",
}


def explain_caps(text: str, start: int, correction: str) -> str:
    """[Fix 2026-10-30]: regla concreta de mayúsculas según la POSICIÓN (inicio de oración o nombre propio), no una frase genérica. Función pura."""
    before = text[:start].rstrip()  # `rstrip` (str): ignora espacios antes de la palabra
    if correction == "I" or re.fullmatch(r"I['’][a-z]+", correction):  # [2026-11-02]: «i'm» → «I'm» también es el pronombre
        return "El pronombre «I» siempre se escribe con mayúscula."
    if not before or before[-1] in ".!?¡¿":  # Primera palabra del texto o tras un signo de fin de oración
        return "La primera palabra de la oración se escribe con mayúscula inicial."
    return "Los nombres propios se escriben con mayúscula inicial."


def explain_es(finding: ErrorFinding) -> str:
    """[2026-10-28]: explicación genérica EN ESPAÑOL de un hallazgo (diff o explicación del LLM en otro idioma). [Principio]: DRY."""
    kind = ErrorType(finding.type.value if hasattr(finding.type, "value") else finding.type)
    return _EXPLANATION.get(kind, _EXPLANATION[ErrorType.GRAMMAR]).format(o=finding.original, c=finding.correction or "∅")


def _tokens(text: str) -> list[re.Match[str]]:
    return list(_TOKEN.finditer(text))  # `re.Match` conserva start()/end() → offsets exactos sobre el texto


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")  # NFD separa la tilde (categoría Mn)


def _classify(original: str, correction: str) -> ErrorType:
    """Tipo probable del cambio. [Paradigma]: función pura."""
    o_toks, c_toks = _TOKEN.findall(original), _TOKEN.findall(correction)
    o_words = [t for t in o_toks if not _PUNCT.match(t)]
    c_words = [t for t in c_toks if not _PUNCT.match(t)]
    if original != correction and original.lower() == correction.lower():  # [2026-10-28]: solo cambian mayúsculas («ana» → «Ana»)
        return ErrorType.CAPITALIZATION
    # [Fix 2026-10-30]: mismas letras con otra separación o apóstrofo («i m» → «I'm», «dont» → «don't») = ortografía | `\W` (regex): todo lo que no es letra/dígito
    if re.sub(r"\W", "", original).lower() == re.sub(r"\W", "", correction).lower() and o_words != c_words:
        return ErrorType.SPELLING
    if _strip_accents(original).lower() == _strip_accents(correction).lower():  # [2026-11-03]: «so» → «só» = tilde
        return ErrorType.SPELLING
    if o_words == c_words:  # Solo cambian signos
        return ErrorType.PUNCTUATION
    if len(o_words) > 1 and sorted(w.lower() for w in o_words) == sorted(w.lower() for w in c_words):
        return ErrorType.WORD_ORDER
    if len(o_words) == 1 and len(c_words) == 1:
        a, b = o_words[0].lower(), c_words[0].lower()
        # Misma inicial y muy parecidas («recieve» → «receive», «helo» → «hello»); «go» → «goes» es gramática
        if a[:1] == b[:1] and SequenceMatcher(None, a, b).ratio() >= 0.75 and not b.startswith(a):
            return ErrorType.SPELLING
    return ErrorType.GRAMMAR


def explain(kind: ErrorType, text: str, start: int, original: str, correction: str) -> str:
    """Explicación del cambio; [2026-10-31]: nombra el apóstrofo que falta («i m» → «I'm»). Función pura."""
    if kind == ErrorType.CAPITALIZATION:
        return explain_caps(text, start, correction)
    if kind == ErrorType.SPELLING and any(q in correction for q in "'’") and not any(q in original for q in "'’"):
        return f"Ortografía: falta el apóstrofo, se escribe «{correction}»."
    if kind == ErrorType.SPELLING and _strip_accents(original).lower() == _strip_accents(correction).lower():
        return f"Ortografía: falta la tilde, se escribe «{correction}»."
    return _EXPLANATION.get(kind, _EXPLANATION[ErrorType.GRAMMAR]).format(o=original, c=correction or "∅")


def _overlaps(start: int, end: int, taken: Sequence[tuple[int, int]]) -> bool:
    return any(start < e and s < end for s, e in taken)  # Intervalos semiabiertos [s, e)


def _split_pairs(opcodes: Sequence[tuple[str, int, int, int, int]]) -> list[tuple[str, int, int, int, int]]:
    """Un «replace» de N tokens por N tokens → N cambios sueltos («i recieve» → «I» + «received»): cada error con su subrayado."""
    out: list[tuple[str, int, int, int, int]] = []
    for op, i1, i2, j1, j2 in opcodes:  # `get_opcodes()` (difflib): (operación, a[i1:i2], b[j1:j2])
        if op == "replace" and i2 - i1 == j2 - j1 > 1:
            out.extend(("replace", i1 + k, i1 + k + 1, j1 + k, j1 + k + 1) for k in range(i2 - i1))
        else:
            out.append((op, i1, i2, j1, j2))
    return out


def diff_findings(text: str, corrected: str) -> list[ErrorFinding]:
    """Un hallazgo por bloque distinto entre `text` y `corrected`, con start/end sobre `text`. [] si la corrección no es comparable."""
    a, b = _tokens(text), _tokens(corrected)
    if not a or not b:
        return []
    # [Fix 2026-10-30 · «i m ana» → «I'm Ana»]: se alinea SIN distinguir mayúsculas (`casefold`, stdlib) → «ana»/«Ana» quedan emparejadas y NO se funden con «i m» en un solo bloque
    # (ese bloque único se solapaba con el hallazgo del LLM y el merge lo descartaba: faltaba la explicación de «Ana») | `autojunk=False`: no descarta tokens frecuentes
    matcher = SequenceMatcher(None, [t.group().casefold() for t in a], [t.group().casefold() for t in b], autojunk=False)
    # [Fix 2026-10-30]: similitud por CARACTERES (no por tokens) → en textos cortos un solo token distinto hundía la razón («i m ana»: 0,4) y se perdía TODO el diff
    if SequenceMatcher(None, text.casefold(), corrected.casefold(), autojunk=False).ratio() < _MIN_SIMILARITY:
        return []
    out: list[ErrorFinding] = []
    for op, i1, i2, j1, j2 in _split_pairs(matcher.get_opcodes()):
        if op == "equal":  # Alineadas sin mayúsculas: cada token que difiere solo en mayúsculas es su propio hallazgo
            out.extend(
                ErrorFinding(type=ErrorType.CAPITALIZATION, original=x.group(), correction=y.group(), explanation_es=explain_caps(text, x.start(), y.group()), start=x.start(), end=x.end())
                for x, y in zip(a[i1:i2], b[j1:j2], strict=True)  # `zip(strict=True)` (3.10): mismos tramos, misma longitud
                if x.group() != y.group()
            )
            continue
        if op == "insert":  # [Inserción]: falta algo («Hello world» → «Hello, world») → se ancla a la palabra anterior (o a la siguiente al inicio)
            if i1 > 0:
                i1, j1 = i1 - 1, j1 - 1
            else:
                i2, j2 = i2 + 1, j2 + 1
        start, end = a[i1].start(), a[i2 - 1].end()
        original = text[start:end]
        correction = corrected[b[j1].start() : b[j2 - 1].end()] if j2 > j1 else ""  # Borrado → corrección vacía
        if not original.strip() or original == correction or len(original) > _MAX_FRAGMENT or len(correction) > _MAX_FRAGMENT:
            continue
        kind = _classify(original, correction)
        if out and out[-1].start == start:  # [Fix 2026-11-02]: «ana» → «Ana» + punto anclado a la misma palabra → UN hallazgo «ana → Ana.» (antes salían dos)
            prev = out.pop()
            out.append(prev.model_copy(update={"end": end, "original": original, "correction": correction, "explanation_es": f"{prev.explanation_es} Además, {'la oración debe terminar con un punto.' if correction.endswith('.') else explain(kind, text, start, original, correction)}"}))
            continue
        out.append(
            ErrorFinding(
                type=kind,
                original=original,
                correction=correction,
                explanation_es=explain(kind, text, start, original, correction),
                start=start,
                end=end,
            )
        )
    return out


def _covers(outer: ErrorFinding, inner: ErrorFinding) -> bool:
    """¿`outer` abarca más texto que `inner` y lo contiene? Función pura."""
    a, b, c, d = outer.start or 0, outer.end or 0, inner.start or 0, inner.end or 0
    return a <= c and d <= b and b - a > d - c


def merge_findings(located: Sequence[ErrorFinding], extra: Sequence[ErrorFinding]) -> list[ErrorFinding]:
    """Hallazgos del LLM + los del diff que no se solapan con ellos, ordenados por posición y con tope. [Patrón]: Merge."""
    # [Fix 2026-10-31 · «i m» → «I'm»]: el LLM listó solo «i → I» y su hallazgo tapaba el del diff («i m → I'm») → se perdía el apóstrofo. El diff compara el texto completo: si contiene al del LLM, el diff gana
    located = [f for f in located if not any(_covers(x, f) for x in extra)]
    # [Fix 2026-11-03 · «ich bi ana» → un solo hallazgo]: el LLM juntó varios errores (o uno mecánico con palabras que no cambian) → ganan los del diff, uno por error
    mechanical = {ErrorType.CAPITALIZATION, ErrorType.SPELLING, ErrorType.PUNCTUATION}
    located = [f for f in located if not ((inner := [x for x in extra if _covers(f, x)]) and (len(inner) > 1 or ErrorType(f.type) in mechanical))]
    taken = [(f.start or 0, f.end or 0) for f in located]
    merged = list(located) + [f for f in extra if not _overlaps(f.start or 0, f.end or 0, taken)]
    return sorted(merged, key=lambda f: f.start or 0)[:MAX_FINDINGS]
