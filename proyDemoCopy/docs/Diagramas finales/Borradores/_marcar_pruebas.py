# -*- coding: utf-8 -*-
"""Marca en las tablas de resultados de pruebas de prueba1.docx:
- ROJO: pruebas listadas que NO se realizaron (archivos de test vacios / no existen).
- AZUL: pruebas realizadas (no vacias) que faltan en el documento -> se agregan.
No elimina ni cambia el contenido existente. Solo colorea o agrega filas."""
import shutil
from docx import Document
from docx.shared import RGBColor

SRC = "prueba1.docx"
shutil.copy(SRC, "prueba1_backup_pretest.docx")

RED = RGBColor(0xFF, 0x00, 0x00)
BLUE = RGBColor(0x00, 0x00, 0xFF)


def paint_row(row, color):
    for cell in row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = color


def paint_cell_text_red_if(row, needles, color):
    txt = row.cells[0].text.strip()
    return any(n in txt for n in needles)


doc = Document(SRC)
tbls = doc.tables
log = []

# --- Tabla idx 29: Frontend integracion. Archivos vacios -> ROJO ---
EMPTY_FE_INT = [
    "AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
    "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx",
]
t = tbls[29]
for row in t.rows[1:]:
    if paint_cell_text_red_if(row, EMPTY_FE_INT, RED):
        paint_row(row, RED)
        log.append(f"ROJO  T29: {row.cells[0].text.strip()}")

# --- Tabla idx 30: Frontend funcional. auth.spec.ts vacio -> ROJO ---
t = tbls[30]
for row in t.rows[1:]:
    txt = row.cells[0].text.strip()
    if txt.endswith("functional/auth.spec.ts"):
        paint_row(row, RED)
        log.append(f"ROJO  T30: {txt}")

# --- Tabla idx 31: Backend unitario. Falta app.controller.spec.ts -> AZUL ---
t = tbls[31]
existing = {r.cells[0].text.strip() for r in t.rows}
add = ("src/app.controller.spec.ts", "Controlador principal de la aplicacion")
if not any("app.controller.spec.ts" in e for e in existing):
    new = t.add_row()
    cells = new.cells
    cells[0].text = add[0]
    cells[1].text = add[1]
    paint_row(new, BLUE)
    log.append(f"AZUL  T31 (+fila): {add[0]}")

doc.save(SRC)
print("\n".join(log))
print(f"\nTotal cambios: {len(log)}")
print(f"Guardado: {SRC} | Respaldo: prueba1_backup_pretest.docx")
