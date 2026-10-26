"""Limpieza de la salida de modelos pequeños (qwen2.5:3b, aya-expanse:8b): JSON tolerante y traducciones «desenvueltas».

[Patrón]: Funciones puras de dominio compartido (Shared Kernel) + Parser tolerante (Postel: liberal en lo que se recibe).
[Principio]: DRY (lo usan LanguageTools —traducción e IPA de líneas— y el avatar de Diálogos) + Fail Safe (basura → None, nunca a la UI).
[Paradigma]: Funcional.
[Bug 2026-10-25]: en «Temas de conversación» la traducción mostraba JSON crudo:
  `{"I like ground meat spicy, …": "Me gusta el carne molida picante, …"}` y `["Incluye tomate, pimientos rojos y verdes, …",]`.
"""

import ast
import json
import re
from typing import Any

from src.shared.domain.text_norm import norm

# `re.compile` (stdlib): patrones precompilados una vez al importar el módulo
_FENCE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$")  # Vallas de código Markdown (```json … ```)
_TRAILING_COMMA = re.compile(r",\s*([\]}])")  # `["a",]` / `{"a": 1,}` → JSON válido sin la coma colgante
_QUOTED = re.compile(r'"((?:[^"\\]|\\.)*)"')  # Cadenas entre comillas dobles (con escapes) para rescatar JSON roto
# Huellas de JSON: empieza por «{» o «["», trae «"clave": "valor"» o termina en «"]» / «"}» («[Estribillo]» NO es JSON)
_JSON_TRACE = re.compile(r'^\s*\{|^\s*\[\s*["{\[\]]|^\s*"[^"]*"\s*:|"\s*:\s*"|"\s*,?\s*[\]}]\s*$')
# Pares de comillas que el modelo pone alrededor de toda la traducción → se quitan (las internas se respetan)
_WRAPPING_QUOTES = (('"', '"'), ("'", "'"), ("«", "»"), ("“", "”"), ("‘", "’"))
# Claves en las que un modelo pequeño suele poner la traducción cuando no respeta el contrato
_TRANSLATION_KEYS = ("translation", "traduccion", "traducción", "translated", "target", "text", "es", "spanish", "español")
_MAX_DEPTH = 4  # Corta la recursión con cadenas que contienen JSON que contiene cadenas…


def strip_fences(raw: str) -> str:
    """Quita ```json … ``` alrededor del texto. [Paradigma]: función pura."""
    return _FENCE.sub("", raw.strip()).strip()


def loads_lenient(raw: str) -> Any | None:
    """JSON tolerante: vallas, comas colgantes y literales de Python (comillas simples). None si no es JSON.

    `ast.literal_eval` (stdlib): evalúa SOLO literales (listas, dicts, cadenas) → seguro, no ejecuta código.
    """
    text = strip_fences(raw)
    if not text or text[0] not in "{[\"'":
        return None
    for candidate in (text, _TRAILING_COMMA.sub(r"\1", text)):
        try:
            return json.loads(candidate)
        except ValueError:  # `json.JSONDecodeError` hereda de ValueError
            pass
        try:
            return ast.literal_eval(candidate)
        except (ValueError, SyntaxError, MemoryError, RecursionError):
            pass
    return None


def looks_like_json(text: str) -> bool:
    """¿Sigue pareciendo JSON (o un fragmento)? Entonces no se muestra como traducción. [Paradigma]: función pura."""
    return bool(_JSON_TRACE.search(text))


def strip_wrapping_quotes(text: str) -> str:
    """«"Hola"» → «Hola» (solo el par que envuelve TODO el texto). [Paradigma]: función pura."""
    t = text.strip()
    for left, right in _WRAPPING_QUOTES:
        if len(t) >= 2 and t.startswith(left) and t.endswith(right) and left not in t[1:-1]:
            return t[1:-1].strip()
    return t


def parse_translation(raw: Any, source: str = "") -> str | None:
    """Saca la traducción de lo que haya devuelto el LLM (texto, dict, lista o JSON en texto); None si no hay nada usable.

    Reglas: dict → clave «translation» (o equivalente), la clave igual al texto origen, o el único valor; lista → su único
    elemento (varios → se unen); texto con JSON → se parsea; si tras todo sigue pareciendo JSON → None.
    """
    value = _unwrap(raw, norm(source), 0)
    if value is None:
        return None
    text = strip_wrapping_quotes(" ".join(value.split()))  # `split/join`: espacios y saltos de línea simples
    return text if text and not looks_like_json(text) else None


def _unwrap(raw: Any, source: str, depth: int) -> str | None:
    """Desenvuelve recursivamente hasta una cadena. [Patrón]: Recursive Descent acotado (_MAX_DEPTH)."""
    if raw is None or depth > _MAX_DEPTH or isinstance(raw, bool):  # `bool` es subclase de int → se descarta antes
        return None
    if isinstance(raw, (int, float)):
        return str(raw)
    if isinstance(raw, dict):
        return _from_dict(raw, source, depth)
    if isinstance(raw, (list, tuple)):
        parts = [p for p in (_unwrap(x, source, depth + 1) for x in raw) if p]
        return " ".join(parts) if parts else None  # Un elemento → él mismo; varios (frases partidas) → unidos
    if not isinstance(raw, str):
        return None
    text = strip_fences(raw)
    if text[:1] in ("{", "["):
        parsed = loads_lenient(text)
        # JSON roto → se rescatan sus cadenas; sin comillas («[Coro] la la») es texto normal (el filtro final decide)
        return _unwrap(parsed, source, depth + 1) if parsed is not None else (_salvage(text, source) or text)
    return text


def _from_dict(raw: dict[Any, Any], source: str, depth: int) -> str | None:
    lowered = {str(k).strip().lower(): v for k, v in raw.items()}  # Comprensión de dict: claves comparables sin mayúsculas
    for key in _TRANSLATION_KEYS:
        if key in lowered:
            return _unwrap(lowered[key], source, depth + 1)
    by_source = next((v for k, v in raw.items() if source and norm(str(k)) == source), None)  # {"<origen>": "<traducción>"}
    if by_source is not None:
        return _unwrap(by_source, source, depth + 1)
    return _unwrap(next(iter(raw.values())), source, depth + 1) if len(raw) == 1 else None


def _salvage(text: str, source: str) -> str | None:
    """JSON roto (sin «}», coma de más): rescata las cadenas CERRADAS. Objeto → valores; lista → elementos.

    Una cadena cortada a mitad (sin comilla de cierre) se descarta: una traducción incompleta también es basura.
    """
    strings = [_unescape(s) for s in _QUOTED.findall(text)]
    if not strings:
        return None
    if text.startswith("{"):
        pairs = list(zip(strings[0::2], strings[1::2]))  # `zip` de slices: (clave, valor) en orden
        hit = next((v for k, v in pairs if source and norm(k) == source), None)
        values = [hit] if hit else [v for _, v in pairs]
        return " ".join(values) or None
    return " ".join(strings)


def _unescape(fragment: str) -> str:
    """Escapes JSON de una cadena rescatada (\\u00f1, \\") sin romper tildes; si no decodifica, se deja tal cual."""
    try:
        return str(json.loads(f'"{fragment}"'))
    except ValueError:
        return fragment
