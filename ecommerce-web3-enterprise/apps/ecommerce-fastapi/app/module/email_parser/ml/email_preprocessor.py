# email_preprocessor.py (mail-parser + html.parser de la biblioteca estándar) => correo crudo (RFC
# 822) o texto -> {subject, sender, text} limpio para NER e intención.
# Patrón: Pipeline (parse -> HTML a texto -> normalizar espacios). Paradigma: funcional.
# html.parser (stdlib) reemplaza a BeautifulSoup: extraer texto de un correo no necesita otra
# librería.

import re
from dataclasses import dataclass
from html.parser import HTMLParser

import mailparser  # mail-parser: parsea correos RFC 822 (cabeceras, partes text/plain y text/html)

MAX_TEXT_CHARS = 5000  # Los correos de soporte caben de sobra; acota CPU y memoria por petición


# CleanEmail => Value Object con el correo listo para analizar
@dataclass(frozen=True)
class CleanEmail:
    subject: str
    sender: str
    text: str


# _TextExtractor => recorre el HTML y conserva solo el texto visible (ignora <script> y <style>)
class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list) -> None:  # Método plantilla de HTMLParser
        self._skip = tag in ("script", "style")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    extractor = _TextExtractor()
    extractor.feed(html)
    return " ".join(extractor.parts)


# normalize => colapsa espacios/saltos de línea y recorta a MAX_TEXT_CHARS
def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()[:MAX_TEXT_CHARS]


# preprocess => acepta un correo crudo completo o, si no trae cabeceras, asunto/cuerpo sueltos
def preprocess(raw: str | None, subject: str = "", body: str = "", sender: str = "") -> CleanEmail:
    if raw:
        mail = mailparser.parse_from_string(raw)
        content = " ".join(mail.text_plain) or html_to_text(" ".join(mail.text_html))
        address = mail.from_[0][1] if mail.from_ else sender  # from_ => [(nombre, correo)]
        return CleanEmail(subject=mail.subject or subject, sender=address, text=normalize(content))
    text = html_to_text(body) if "<" in body else body
    return CleanEmail(subject=subject, sender=sender, text=normalize(text))
