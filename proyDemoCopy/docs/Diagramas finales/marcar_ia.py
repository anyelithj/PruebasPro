# -*- coding: utf-8 -*-
"""Marca en rojo los pasajes con señales de generación IA / riesgo de integridad
detectados en la auditoría de originalidad. Genera prueba_marcado_IA.docx."""
import re
from docx import Document
from docx.shared import RGBColor

SRC = "prueba.docx"
DST = "prueba.docx"  # marca en el mismo documento (respaldo: prueba_backup_original.docx)

RED = RGBColor(0xFF, 0x00, 0x00)

# Criterios de alta confianza (evidencia mecánica, no estilística)
SUBSTRINGS = [
    # 1. Placeholders de plantilla sin rellenar
    "[Autor]",
    "[autor]",
    # 3. Duplicación de afirmación en el Resumen
    "permitiendo la incorporación de componentes de IA para personalizar la educación a gran escala",
    # 4. Párrafo duplicado (2.ª copia) en Arquitectura de Microservicios
    "Las solicitudes autenticadas se envían al backend usando JWT",
    # 5. Objetivo duplicado Sprint 3
    "Se llevará a cabo la calificación automática con FastAPI, junto con la entrega de comentarios",
    # 11. Referencia rota generada por herramienta
    "(N.d.). Researchgate.net",
    # 12. Referencia irrelevante (física cuántica) nunca citada
    "Experimental implementation of fully controlled dephasing",
]

# 2. Notas de figura con autor vacío ("por , 2026" / "by , 2026")
EMPTY_AUTHOR = re.compile(r"\b(por|by)\s+,\s*20\d\d")

# 6. Definiciones del marco teórico sin citas (paráfrasis IA de docs oficiales)
STARTSWITH = [
    "Next.js es un framework",
    "Tailwind CSS es un framework",
    "NestJS es un framework",
    "FastAPI es un framework",
    "PostgreSQL es un sistema",
    "JSON Web Tokens (JWT) son un estándar",
    "Scrum es un marco ágil",
    "El Lenguaje Unificado de Modelado (UML)",
]

# 13. Referencias huérfanas (en REFERENCIAS pero nunca citadas en el texto)
ORPHAN_REFS = [
    "Beal, C., &", "Chan, P., Van Gerven", "Conijn, R., Cook",
    "Crompton, H., &", "Friedman, N., Fekete", "Henderson, M. L., &",
    "Jewitt, C., Chubinidze", "Liu, Z.-D., Lyyra", "Morris, T. H., &",
    "Papadopoulos, P. M., Obwegeser", "Trentsios, P., Wolf",
    "Wang, Y.-H. (2020)", "Zendler, A., &",
]


def flagged(text):
    t = text.strip()
    if not t:
        return False
    if any(s in t for s in SUBSTRINGS):
        return True
    if EMPTY_AUTHOR.search(t):
        return True
    if any(t.startswith(s) for s in STARTSWITH):
        return True
    if any(t.startswith(s) for s in ORPHAN_REFS):
        return True
    return False


def paint(par):
    for run in par.runs:
        run.font.color.rgb = RED


def iter_pars(doc):
    for p in doc.paragraphs:
        yield p
    for tbl in doc.tables:
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    yield p


doc = Document(SRC)
count = 0
for p in iter_pars(doc):
    if flagged(p.text):
        paint(p)
        count += 1

doc.save(DST)
print(f"Parrafos marcados en rojo: {count}")
print(f"Guardado: {DST}")
