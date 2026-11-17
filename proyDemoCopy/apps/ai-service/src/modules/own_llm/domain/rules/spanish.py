"""Reglas deterministas del español: signos de apertura ¿ y ¡ (Anexo A, regla 7).

En español la pregunta y la exclamación llevan signo de apertura Y de cierre («¿Cómo estás?», «¡Qué bien!»); el estudiante que viene
del inglés suele escribir solo el de cierre. También aplica cuando la pregunta no tiene signo final pero empieza con un interrogativo
con tilde («Cómo estás» → «¿Cómo estás?»: el «?» lo añade common.final_mark).
[Patrón]: regla pura | [Principio]: SRP (solo los signos de apertura; la mayúscula se integra aquí para no duplicar hallazgos) | [Paradigma]: Funcional.
"""

import re  # stdlib: expresiones regulares

from src.modules.own_llm.domain.rules.common import CAPITAL_START, WORD, is_question
from src.modules.own_llm.domain.rules.context import RuleContext
from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
from src.modules.own_llm.domain.writing_finding import WritingFinding as F

_SENTENCE = re.compile(r"[^.!?]+[.!?]+|[^.!?]+$")  # Oración = texto hasta su signo final (o hasta el final del texto)
_OPEN = {"?": ("¿", "Las preguntas en español llevan signo de apertura (¿) además del de cierre (?)."),
         "!": ("¡", "Las exclamaciones en español llevan signo de apertura (¡) además del de cierre (!).")}  # fmt: skip


def spanish_findings(text: str, ctx: RuleContext) -> list[F]:
    """Falta «¿» o «¡» al inicio de la oración → se añade (con la mayúscula inicial si también faltaba). Función pura."""
    out: list[F] = []
    for s in _SENTENCE.finditer(text):
        sentence = s.group()
        end = sentence.rstrip()[-1:]  # Signo de cierre de ESTA oración
        # Sin signo de cierre (ni «.») y empieza con interrogativo → es pregunta («Cómo estás» → «¿Cómo estás?»)
        kind = end if end in _OPEN else ("?" if end not in ".…" and is_question(sentence, ctx.language) else "")
        if not kind or _OPEN[kind][0] in sentence:
            continue
        first = WORD.search(sentence)
        if not first:
            continue
        mark, why = _OPEN[kind]
        w = first.group()
        cap = w[0].upper() + w[1:]
        start = s.start() + first.start()
        out.append(F(type=T.PUNCTUATION, original=w, correction=f"{mark}{cap}", start=start, end=start + len(w),
                     explanation_es=why if cap == w else f"{why} {CAPITAL_START}"))  # fmt: skip
    return out
