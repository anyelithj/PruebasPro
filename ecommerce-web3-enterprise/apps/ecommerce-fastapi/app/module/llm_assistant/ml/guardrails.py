# guardrails.py (Python re) => controles de entrada y salida del asistente (Plan 5B.3): bloquea
# secretos de billetera, redacta datos personales (PII) antes de guardarlos o enviarlos al LLM y
# valida la respuesta del modelo antes de persistirla.
# Patrón: Chain of Responsibility (cada guard recibe el texto, lo transforma o corta la cadena con
# GuardrailViolationError; agregar un control = agregar una función a la lista, OCP).
# Paradigma: funcional (funciones puras texto -> texto; regex compiladas una sola vez).

import re
from collections.abc import Callable

from app.module.llm_assistant.exception.llm_exception import GuardrailViolationError

Guard = Callable[[str], str]  # Eslabón de la cadena: recibe texto y devuelve texto (o lanza)

# Clave privada EVM: 64 hex (con o sin 0x). Una dirección pública (40 hex) NO coincide: se permite
PRIVATE_KEY = re.compile(r"\b(?:0x)?[0-9a-fA-F]{64}\b")
# Frase semilla BIP-39: 12 a 24 palabras minúsculas seguidas Y una palabra clave en el mensaje
# (la racha de palabras sola daría falsos positivos con frases normales sin tildes)
SEED_PHRASE = re.compile(r"\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b")
SEED_HINT = re.compile(r"semilla|seed|mnemonic|recuperaci[oó]n|recovery|\d{2} palabras", re.I)
EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
# Teléfono: 10–15 dígitos con separadores opcionales y prefijo "+" (E.164). No toca números de
# pedido "ORD-20261004-0001" (guion pegado) ni precios cortos
PHONE = re.compile(r"(?<![\w-])\+?\d(?:[\s-]?\d){9,14}(?![\w-])")
CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")  # Número de tarjeta (PCI: nunca se almacena)
MAX_ANSWER_CHARS = 4000


# _luhn => dígito verificador de tarjetas: evita redactar números largos que no son tarjetas
def _luhn(number: str) -> bool:
    digits = [int(d) for d in reversed(number)]
    total = sum(digits[0::2]) + sum(sum(divmod(2 * d, 10)) for d in digits[1::2])
    return total % 10 == 0


def block_wallet_secrets(text: str) -> str:
    if PRIVATE_KEY.search(text) or (SEED_HINT.search(text) and SEED_PHRASE.search(text)):
        raise GuardrailViolationError(
            "Por seguridad no compartas tu frase semilla ni tu clave privada: nadie de la tienda "
            "te las pedirá. Si ya las compartiste, mueve tus fondos a una billetera nueva."
        )
    return text


def redact_cards(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", match.group())
        return "[tarjeta]" if 13 <= len(digits) <= 19 and _luhn(digits) else match.group()

    return CARD.sub(replace, text)


def redact_contacts(text: str) -> str:
    return PHONE.sub("[teléfono]", EMAIL.sub("[correo]", text))


def limit_length(text: str) -> str:
    return text[:MAX_ANSWER_CHARS]


# Orden: primero bloquear secretos (corta la cadena), luego redactar (tarjeta antes que teléfono:
# ambos son secuencias de dígitos)
INPUT_GUARDS: list[Guard] = [block_wallet_secrets, redact_cards, redact_contacts]
# Salida: el modelo podría repetir PII del contexto o "inventar" una clave; nunca se persiste
OUTPUT_GUARDS: list[Guard] = [redact_cards, redact_contacts, limit_length]


def run_chain(guards: list[Guard], text: str) -> str:
    for guard in guards:
        text = guard(text)
    return text


def guard_input(text: str) -> str:
    return run_chain(INPUT_GUARDS, text)


# Salida: un secreto en la respuesta no corta la cadena (ya se transmitió): se reemplaza
def guard_output(text: str) -> str:
    return run_chain(OUTPUT_GUARDS, PRIVATE_KEY.sub("[dato oculto]", text))
