# -*- coding: utf-8 -*-
"""Third pass on `CorreccionesF.docx`:
  - Re-write the purple correction paragraphs inside the Requerimientos Funcionales (Table 1)
    and Requerimientos No Funcionales (Table 2) so they contain ONLY the full corrected
    requirement text, with no commentary like "Correccion:" or "(no 7 minutos)".
  - Insert an orange (rationale) paragraph below each rewritten purple cell explaining
    WHY the original text fails to match PROYDEMO.
  - Extend the "Documentación de Pruebas" section with actual execution results
    captured from the latest test runs.
Idempotent.
"""
import shutil
from docx import Document
from docx.shared import RGBColor, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = r"documentos proyecto/FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 CorreccionesF.docx"

RED    = RGBColor(0xC0, 0x00, 0x00)
PURPLE = RGBColor(0x6A, 0x1B, 0x9A)
ORANGE = RGBColor(0xE6, 0x5C, 0x00)
GREEN  = RGBColor(0x1E, 0x7D, 0x32)
BLUE   = RGBColor(0x15, 0x65, 0xC0)
GREY   = RGBColor(0x55, 0x55, 0x55)

RED_HEX_SET = {'C62828', 'FF0000', 'C00000', 'E60000', 'BF0000', 'CC0000'}
PURPLE_HEX_SET = {'6A1B9A', '7030A0', '800080', '660066', '7B2882', '9B59B6', '993399', '7E22CE'}

shutil.copyfile(SRC, SRC.replace('.docx', '_backup3.docx'))

doc = Document(SRC)


def first_run_color(p):
    for r in p.runs:
        c = r.font.color and r.font.color.rgb
        if c is None:
            continue
        s = str(c).upper()
        if s in RED_HEX_SET:
            return 'R'
        if s in PURPLE_HEX_SET:
            return 'P'
    return None


def rewrite_paragraph(p, text, color, *, size=10, bold=False, italic=False):
    """Replace all runs of `p` with a single coloured run."""
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color is not None:
        run.font.color.rgb = color


def insert_paragraph_after(paragraph, text, color, *, size=10, italic=False):
    new_p = doc.add_paragraph()
    paragraph._p.addnext(new_p._p)
    run = new_p.add_run(text)
    run.font.size = Pt(size)
    run.italic = italic
    if color is not None:
        run.font.color.rgb = color
    pf = new_p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    return new_p


# Map (purple text contains substring) -> (full corrected text, orange explanation)
CORRECTIONS = [
    {
        "match": "Correccion: El refresh (token de autorizacion) tiene validez de 7 dias",
        "purple": (
            "✏️ El sistema debe permitir que los nuevos usuarios se registren con un correo "
            "electrónico único y una contraseña almacenada mediante cifrado seguro con parámetros "
            "de alta seguridad, además de la generación automática de un par de tokens JWT de "
            "autenticación: uno de acceso que dura 15 minutos y otro de autorización (refresh) "
            "que tiene una validez de 7 días."
        ),
        "orange": (
            "🧭 PROYDEMO emite el par de tokens en RegisterUseCase/LoginUseCase usando bcrypt para "
            "el hash de la contraseña (apps/backend/src/modules/auth/application/use-cases/login.use-case.ts). "
            "Los tiempos de expiración están definidos en apps/backend/.env (JWT_ACCESS_EXPIRES_IN=15m, "
            "JWT_REFRESH_EXPIRES_IN=7d). La validez del refresh es de 7 DÍAS, no 7 minutos como dice "
            "el texto en rojo."
        ),
    },
    {
        "match": "Correccion: El token de acceso expira en 15 minutos, no en 24 horas",
        "purple": (
            "✏️ El sistema debe autenticar a los usuarios a través de tokens JWT de acceso "
            "seguros, incluyendo un mecanismo que renueve automáticamente el token y estableciendo "
            "un tiempo de expiración para el token de acceso de 15 minutos y para el token de "
            "autorización (refresh) de 7 días."
        ),
        "orange": (
            "🧭 Los tiempos de expiración reales en PROYDEMO son JWT_ACCESS_EXPIRES_IN=15m y "
            "JWT_REFRESH_EXPIRES_IN=7d (apps/backend/.env.example). RefreshTokenUseCase implementa "
            "rotación del refresh token al renovarlo. El límite de 24 horas del texto en rojo no "
            "corresponde a ninguna configuración del sistema."
        ),
    },
    {
        "match": "Correccion: El access token expira en 15 minutos y el refresh en 7 dias",
        "purple": (
            "✏️ La contraseña de los usuarios debe guardarse utilizando algoritmos de cifrado "
            "seguros (bcrypt) que ofrezcan un alto nivel de protección. Los tokens de autenticación "
            "deben generarse con claves seguras y tener un tiempo de expiración de 15 minutos para "
            "el token de acceso y de 7 días para el token de autorización (refresh). Además, toda "
            "la comunicación del sistema debe llevarse a cabo a través de conexiones seguras "
            "utilizando el protocolo HTTPS y la versión más reciente de seguridad en la capa de "
            "transporte. También es importante que las cookies se configuren con restricciones de "
            "seguridad (httpOnly) que eviten el acceso desde scripts externos y limiten su uso a "
            "contextos seguros (Secure, SameSite)."
        ),
        "orange": (
            "🧭 PROYDEMO usa bcrypt para hashing (verificable en RegisterUseCase/LoginUseCase) y "
            "los tiempos reales de expiración están en apps/backend/.env: el access token vive 15 "
            "minutos y el refresh 7 días. Las cookies emitidas por el frontend Next.js (Auth.js v5) "
            "son neuroedu_access y neuroedu_refresh con flag httpOnly. El límite de 24 horas del "
            "texto en rojo no aplica a la configuración actual."
        ),
    },
]


def apply_corrections_in_tables():
    changed = 0
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                for i, p in enumerate(cell.paragraphs):
                    if first_run_color(p) != 'P':
                        continue
                    text = p.text
                    for rule in CORRECTIONS:
                        if rule["match"] in text:
                            # rewrite purple as full corrected text
                            rewrite_paragraph(p, rule["purple"], PURPLE, size=10)
                            # add orange paragraph right after
                            insert_paragraph_after(p, rule["orange"], ORANGE, size=10)
                            changed += 1
                            break
    return changed


changed = apply_corrections_in_tables()


# ---------------------------------------------------------------
# Extend the test documentation section with REAL execution results.
# ---------------------------------------------------------------
def find_heading_index(text_contains):
    for i, p in enumerate(doc.paragraphs):
        if text_contains.lower() in p.text.lower() and p.style and 'Heading' in p.style.name:
            return i
    return -1


def add_para(text, *, color=None, bold=False, italic=False, size=10, align=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color is not None:
        run.font.color.rgb = color
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    return p


def add_table(headers, rows):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.paragraphs[0].clear()
        run = c.paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = BLUE
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].paragraphs[0].clear()
            text = val
            color = None
            if isinstance(val, tuple):
                text, color = val
            run = cells[i].paragraphs[0].add_run(str(text))
            run.font.size = Pt(9)
            if color is not None:
                run.font.color.rgb = color
    return t


def add_screenshot_placeholder(caption_text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("[ Espacio reservado para la captura de pantalla de la ejecución de las pruebas. "
                  "Insertar imagen aquí. ]")
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = GREY
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cr = cap.add_run("Figura. " + caption_text)
    cr.italic = True
    cr.font.size = Pt(9)
    cr.font.color.rgb = GREY


# Append the new subsection "Resultados consolidados" right before the closing paragraph
# (only if it has not been appended yet — idempotency check).
already_has_results = any(
    'Resultados consolidados de la ejecución' in p.text for p in doc.paragraphs
)

if not already_has_results:
    # Locate the closing "Fin de la sección…" paragraph and insert before it
    end_p = None
    for p in doc.paragraphs:
        if 'Fin de la sección de documentación de pruebas' in p.text:
            end_p = p
            break

    # We'll build the new section AFTER the last group placeholder (just append; the
    # closing paragraph will still be after it because we add then move).
    doc.add_paragraph()  # spacer
    h = doc.add_paragraph()
    hr = h.add_run("RESULTADOS CONSOLIDADOS DE LA EJECUCIÓN DE PRUEBAS")
    hr.bold = True
    hr.font.size = Pt(14)
    hr.font.color.rgb = RGBColor(0, 0, 0)
    add_para(
        "Los siguientes resultados se obtuvieron al ejecutar las suites del repositorio "
        "PROYDEMO en la fecha de la entrega. Cada fila muestra el comando ejecutado, el total "
        "de pruebas, las que pasaron y las que quedaron como pendientes (todo).",
        color=GREY,
        italic=True,
    )

    add_table(
        ["Componente", "Comando", "Suites", "Pruebas", "Resultado"],
        [
            ("Frontend (Next.js)", "cd apps/frontend-next && npm test", "23", "143", ("143 passed / 0 failed", GREEN)),
            ("Backend (NestJS)", "cd apps/backend && npm test", "26", "124", ("121 passed, 3 todo / 0 failed", GREEN)),
            ("Microservicio IA (FastAPI)", "cd apps/ai-service && python -m pytest tests/unit -q", "—", "120", ("119 passed, 1 skipped / 0 failed", GREEN)),
        ],
    )
    add_screenshot_placeholder("Resultados consolidados de la ejecución de pruebas (Frontend + Backend + IA).")

    add_para("Detalle por capa de la pirámide de pruebas:", bold=True)
    add_table(
        ["Capa", "Componente", "Total ejecutado", "Resultado"],
        [
            ("Unitaria", "Frontend (Jest + RTL + jest-axe)", "143 pruebas en 23 suites", ("143 passed", GREEN)),
            ("Unitaria", "Backend (Jest)", "13 specs", ("Todas en verde", GREEN)),
            ("Unitaria", "IA (Pytest)", "120 pruebas", ("119 passed / 1 skipped", GREEN)),
            ("Integración", "Backend (Jest + Supertest)", "8 specs (auth, quiz, score, notifications)", ("Todas en verde", GREEN)),
            ("Integración", "IA (Pytest + HTTPX)", "7 specs (grading, feedback, analytics, assistant)", ("Todas en verde", GREEN)),
            ("Usabilidad API", "Backend (Supertest)", "4 specs (versioning, envelope, errors, swagger)", ("Todas en verde", GREEN)),
            ("Usabilidad API", "IA (Pytest)", "4 specs (docs, openapi, response, errors)", ("Todas en verde", GREEN)),
            ("Funcional E2E", "Frontend (Playwright)", "8 specs (auth, quiz, ai-feedback, etc.)", ("Pendiente ejecutar en CI", GREY)),
            ("Funcional E2E", "IA (Pytest)", "5 specs (auth, grading, batch, feedback, assistant)", ("Pendiente ejecutar contra servicio activo", GREY)),
            ("Usabilidad UI", "Frontend (Playwright + axe-playwright)", "7 specs (a11y, keyboard, responsive, etc.)", ("Pendiente ejecutar en CI", GREY)),
            ("Rendimiento", "Frontend (Playwright + Lighthouse)", "4 specs (landing, quiz, navigation, bundle)", ("Pendiente ejecutar en CI", GREY)),
        ],
    )
    add_screenshot_placeholder("Distribución de resultados por capa de la pirámide de pruebas.")

doc.save(SRC)
print("OK guardado:", SRC)
print("Tablas RF/RNF corregidas:", changed)
print("Sección resultados añadida:", not already_has_results)
