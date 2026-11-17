"""Reglas deterministas del inglés para el corrector (estilo GrammarMama): un hallazgo por error con su regla en español.

[2026-11-02]: los modelos pequeños fundían «i m teacher» en un solo «i m → I'm» con la explicación equivocada y olvidaban el artículo
→ estas reglas marcan SIEMPRE «i → I» (Mayúsculas), «m → 'm» (Puntuación), «teacher → a teacher» (Artículo).
[2026-11-13 · Caso A y Anexo A]: + «a/an» según el SONIDO (an hour, a university), «I'm on from» → «I'm from», oraciones pegadas
(«Laura I'm» → «Laura. I'm») y palabra mal dictada según la pregunta previa («What's your name?» + «my niece is…» → «name»).
La mayúscula inicial y el signo final viven en rules/common.py (comunes a los 7 idiomas).
Ganan a los hallazgos del LLM que se solapan con ellas y siguen funcionando si Ollama está caído.
[Patrón]: Rule Engine mínimo (tablas + un recorrido) | [Principio]: determinístico primero | [Paradigma]: Funcional (puro, sin E/S).
"""

import re  # stdlib: expresiones regulares

from src.modules.own_llm.domain.rules.common import without_overlaps
from src.modules.own_llm.domain.rules.context import RuleContext
from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
from src.modules.own_llm.domain.writing_finding import WritingFinding as F
from src.shared.domain.error_finding import ErrorFinding  # Los hallazgos del LLM llegan con el tipo base

_WORD = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
_PRONOUNS = frozenset({"i", "you", "we", "they", "he", "she", "it", "that", "there", "what", "who"})
# Cola de contracción escrita suelta («i m», «you re») → forma completa (para explicar qué letra falta)
_TAILS = {"m": "am", "re": "are", "ve": "have", "ll": "will", "s": "is", "d": "would"}
_NO_APOSTROPHE = {
    "dont": "don't", "doesnt": "doesn't", "didnt": "didn't", "cant": "can't", "wont": "won't", "isnt": "isn't",
    "arent": "aren't", "wasnt": "wasn't", "werent": "weren't", "havent": "haven't", "hasnt": "hasn't",
    "couldnt": "couldn't", "shouldnt": "shouldn't", "wouldnt": "wouldn't", "im": "I'm", "ive": "I've",
    "youre": "you're", "theyre": "they're", "thats": "that's", "whats": "what's", "lets": "let's",
}  # fmt: skip
_BE = frozenset({"am", "is", "are", "was", "were", "be", "'m", "'s", "'re", "i'm", "you're", "he's", "she's", "it's", "we're", "they're"})
# ponytail: lista cerrada de profesiones frecuentes (A1–B1); ampliar si los docentes ven huecos
_JOBS = frozenset(
    "teacher student doctor nurse engineer lawyer dentist farmer driver pilot cook chef waiter waitress singer actor actress "
    "writer artist painter musician dancer police policeman firefighter mechanic secretary manager scientist programmer developer "
    "designer architect journalist photographer vet pharmacist accountant cashier baker butcher plumber electrician carpenter "
    "soldier athlete player footballer housewife student nanny receptionist hairdresser tailor builder officer judge professor".split()
)
_PRONOUN_I = "El pronombre personal 'I' en inglés siempre se escribe con mayúscula."

# [a/an por SONIDO · Anexo A regla 6]: excepciones a la regla de la letra | ponytail: listas cerradas de palabras A1–B2; ampliar con los docentes
_VOWEL_SOUND = frozenset("hour hours honest honestly honor honour honorable honourable heir heiress".split())  # «h» muda → an
_CONSONANT_SOUND = frozenset(
    "university universities unit units uniform union unique united universe universal unicorn usual useful useless user users "
    "use utensil utility euro euros european eulogy one once ukulele uranium ewe unicycle".split()
)  # «u»/«eu»/«o» que suenan /j/ o /w/ → a
_AN_RULE = "Se usa «a» antes de sonido de consonante y «an» antes de sonido de vocal (a university, an hour)."


def article_for(word: str) -> str:
    """Artículo indefinido correcto por el SONIDO inicial de `word`. Función pura."""
    lw = word.lower()
    if lw in _VOWEL_SOUND:
        return "an"
    if lw in _CONSONANT_SOUND:
        return "a"
    return "an" if lw[:1] in "aeiou" else "a"


# [«I'm on from Colombia»]: preposición sobrante entre «to be» y «from» (también dictado «i m on from») | `(?i)`: sin distinguir mayúsculas
_ON_FROM = re.compile(r"(?i)\b(?:am|is|are|was|were|m|['’]m|['’]s|['’]re)\s+((?:on|in|at)\s+)from\b")
# [Oraciones pegadas]: «… is Laura I'm …» → falta el punto antes del segundo sujeto «I» (sin conjunción ni verbo que las una)
_SECOND_I = re.compile(r"(?i)\b(i['’]m|i\s+am|i\s+m)\b")
_JOINERS = frozenset("and but or so because that when if than as where who which think thought know knew believe say said hope guess wish while".split())
# [Pregunta por el nombre]: el dictado confunde «name» con palabras parecidas | ponytail: confusiones observadas en inglés; otros idiomas, sin datos aún
_ASKS_NAME = re.compile(r"(?i)\b(?:what['’]?s|what is)\s+your\s+name\b|\byour name\b")
_NAME_SOUNDALIKES = frozenset("niece nice knees neighs nein game same mane nam naim lame names".split())


def english_findings(text: str, ctx: RuleContext | None = None) -> list[ErrorFinding]:
    """Hallazgos deterministas del inglés sobre `text` (el signo final se añade en common.final_mark). Función pura."""
    ctx = ctx or RuleContext("en")
    words = list(_WORD.finditer(text))
    out: list[F] = []
    eff: list[str] = []  # Forma YA corregida de cada palabra (en minúsculas) → «i m» cuenta como «I'm» para la regla del artículo
    for k, m in enumerate(words):
        w, lw, start = m.group(), m.group().lower(), m.start()
        prev = words[k - 1] if k else None
        # [2026-11-10 · «Laura I I am»]: palabra repetida seguida → sobra una («that that» y «had had» pueden ser correctas)
        if prev and lw == prev.group().lower() and lw not in ("that", "had") and text[prev.end() : start].isspace():
            out.append(F(type=T.GRAMMAR, original=w, correction="", start=prev.end(), end=m.end(), explanation_es=f"Palabra repetida: «{w}» aparece dos veces seguidas; sobra una."))
            eff.append(lw)
            continue
        if prev and lw in _TAILS and prev.group().lower() in _PRONOUNS and text[prev.end() : start].isspace():
            subject = "I" if prev.group().lower() == "i" else prev.group().lower()
            out.append(F(type=T.PUNCTUATION, original=w, correction=f"'{lw}", start=prev.end(), end=m.end(), explanation_es=(
                f"La contracción de '{subject} {_TAILS[lw]}' es '{subject}'{lw}' y requiere un apóstrofo en lugar de la letra omitida; "
                f"no puede escribirse como '{lw}' suelta."
            )))  # fmt: skip  # start = espacio previo → al aplicar queda «I'm» pegado
            eff.append(f"'{lw}")
            continue
        if lw in _NO_APOSTROPHE:
            c = _NO_APOSTROPHE[lw]
            c = c[0].upper() + c[1:] if w[0].isupper() else c
            out.append(F(type=T.SPELLING, original=w, correction=c, start=start, end=m.end(), explanation_es=f"Falta el apóstrofo de la contracción: se escribe '{c}'."))
            eff.append(c.lower())
            continue
        eff.append(lw)
        nxt = words[k + 1] if k + 1 < len(words) else None
        if w == "i" or re.fullmatch(r"i['’][a-z]+", w):
            out.append(F(type=T.CAPITALIZATION, original=w, correction="I" + w[1:], start=start, end=m.end(), explanation_es=_PRONOUN_I))
        elif lw in ("a", "an") and nxt and not nxt.group().isupper() and (right := article_for(nxt.group())) != lw:  # `isupper`: siglas (an MBA) se respetan
            out.append(F(type=T.ARTICLE, original=w, correction=right if w.islower() else right.capitalize(), start=start, end=m.end(), explanation_es=_AN_RULE))
        elif lw in _JOBS and k and eff[k - 1] in _BE:
            out.append(F(type=T.ARTICLE, original=w, correction=f"{article_for(w)} {w}", start=start, end=m.end(), explanation_es=(
                "En inglés, las profesiones en singular necesitan el artículo indefinido 'a' o 'an' después del verbo 'to be'."
            )))  # fmt: skip
    # Prioridad: lo detectado palabra a palabra gana («Laura I I am» = palabra repetida, no dos oraciones)
    return without_overlaps([out, _transcription(text, words, ctx), _on_from(text), _run_on(text, words)])


def _on_from(text: str) -> list[F]:
    """«I'm on from Colombia» → «I'm from Colombia» (la preposición sobra). Función pura."""
    return [
        F(type=T.GRAMMAR, original=f"{m.group(1)}from", correction="from", start=m.start(1), end=m.end(), explanation_es=(
            f"Para decir de dónde eres se usa «I'm from»; «{m.group(1).strip()}» sobra."
        ))  # fmt: skip
        for m in _ON_FROM.finditer(text)
    ]


def _run_on(text: str, words: list[re.Match[str]]) -> list[F]:
    """Dos oraciones sin punto («My name is Laura I'm from…») → punto antes del segundo «I». Función pura."""
    out: list[F] = []
    for m in _SECOND_I.finditer(text):
        before = [w for w in words if w.end() <= m.start()]
        if not before or text[before[-1].end() : m.start()].strip():  # Ya hay un signo entre ambas oraciones
            continue
        clause = [w.group().lower() for w in before]
        if before[-1].group().lower() in _JOINERS or not any(w in _BE for w in clause):  # Unidas por conjunción, o sin oración previa completa
            continue
        gap_start, gap_end = before[-1].end(), m.start()
        out.append(F(type=T.PUNCTUATION, original=text[gap_start:gap_end], correction=". ", start=gap_start, end=gap_end,
                     explanation_es=f"Cada oración termina con punto: «{before[-1].group()}. {m.group()[:1].upper()}{m.group()[1:]}…»."))  # fmt: skip
    return out


def _transcription(text: str, words: list[re.Match[str]], ctx: RuleContext) -> list[F]:
    """La pregunta pedía el nombre y el estudiante dijo «my niece is Laura» → el dictado oyó mal «name». Función pura."""
    if not _ASKS_NAME.search(ctx.question):
        return []
    for k in range(len(words) - 2):
        my, noun, be = (w.group().lower() for w in words[k : k + 3])
        if my == "my" and noun in _NAME_SOUNDALIKES and be in ("is", "'s"):
            m = words[k + 1]
            why = f"Aula preguntó tu nombre; «{m.group()}» parece un error de reconocimiento de voz por «name»."
            if not ctx.spoken:
                why = f"Te preguntaron tu nombre: se dice «my name is…»; «{m.group()}» significa otra cosa."
            return [F(type=T.TRANSCRIPTION if ctx.spoken else T.VOCABULARY, original=m.group(), correction="name", start=m.start(), end=m.end(), explanation_es=why)]
    return []


_PRESENT_BE = {"i": "am", "you": "are", "we": "are", "they": "are"}  # Resto de sujetos (he, she, it, «my name»…) → «is»
# ponytail: lista cerrada de palabras comunes (nunca nombres propios); ampliar si el modelo inventa otras mayúsculas
_COMMON = frozenset(
    "name my your his her our their is am are was were be have has had do does did and or but so because from to in on at for with "
    "of the a an this that these those live lived like love want need go going come work study years old age city country family "
    "friend friends brother sister mother father home school food yes no too also very here there now always never bye goodbye".split()
)
_SPANISH_FORM = re.compile(r"[áéíóúñ¿¡]|\w(?:osa|osos|osas|ción|ciones|mente)\b", re.I)  # «deliciosa», «información»: español en una corrección inglesa


def plausible(text: str, f: ErrorFinding) -> bool:
    """[2026-11-10 · «My name is Paula» → «My Name Am Paula Am…»]: ¿el hallazgo del LLM tiene sentido? Descarta: quitar el sujeto («I → ∅»),
    cambiar un «to be» que ya concuerda con su sujeto («name is → Am») y meter español («delicio → deliciosa»). Función pura."""
    o, c = f.original.strip(), f.correction.strip()
    if not c and o.lower() in _PRONOUNS:
        return False
    # [2026-11-10 · «name → Name · nombres propios»]: mayúscula a mitad de frase en una palabra común = invento del modelo
    if c[:1].isupper() and c.lower() == o.lower() and o.lower() in _COMMON and f.start and text[: f.start].rstrip()[-1:] not in (".", "!", "?", ""):
        return False
    if any(ch.isdigit() for ch in o):  # [2026-11-10]: «10 → ten» con «números romanos»: escribir la cifra no es un error
        return False
    if len(o.split()) >= 2 and not re.search(r"[A-Za-z]", c):  # «my whole life ever say → ,»: borrar palabras del alumno no corrige nada
        return False
    if _SPANISH_FORM.search(c) and not _SPANISH_FORM.search(o):
        return False
    lo, lc = o.lower().strip(".,!?"), c.lower().strip(".,!?")
    if lo in ("am", "is", "are") and lc in ("am", "is", "are") and f.start is not None:
        prev = list(_WORD.finditer(text[: f.start]))
        subject = prev[-1].group().lower() if prev else ""
        return lc == _PRESENT_BE.get(subject, "is")  # Solo vale si deja la forma que pide el sujeto
    return True
