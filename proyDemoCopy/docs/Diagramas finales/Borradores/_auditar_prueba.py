# -*- coding: utf-8 -*-
"""Audita y corrige Prueba.docx siguiendo las reglas del usuario.
- Verde: info correcta y validada (backend + frontend + integraci\u00f3n)
- Rojo: info incorrecta, inexistente o parcial
- Morado: correcci\u00f3n completa del texto auditado
- Naranja: explicaci\u00f3n t\u00e9cnica
- Azul: info implementada pero ausente en el documento
"""
import shutil, re
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup_auditoria.docx"
shutil.copy(SRC, BACKUP)

GREEN  = RGBColor(0x00, 0x80, 0x00)
RED    = RGBColor(0xFF, 0x00, 0x00)
PURPLE = RGBColor(0x80, 0x00, 0x80)
ORANGE = RGBColor(0xFF, 0x8C, 0x00)
BLUE   = RGBColor(0x00, 0x00, 0xFF)
BLACK  = RGBColor(0x00, 0x00, 0x00)

doc = Document(SRC)
log = []

def paint_run(run, color, bold=False):
    run.font.color.rgb = color
    if bold:
        run.font.bold = True

def paint_paragraph(para, color):
    for run in para.runs:
        paint_run(run, color)

def add_paragraph_after(para, text, color, bold=False, size=None):
    """Insert a new paragraph right after `para`."""
    new_p_elem = OxmlElement('w:p')
    para._element.addnext(new_p_elem)
    new_para = type(para)(new_p_elem, doc)
    run = new_para.add_run(text)
    run.font.color.rgb = color
    if bold:
        run.font.bold = True
    if size:
        run.font.size = Pt(size)
    return new_para

def paragraph_contains(para, needles):
    txt = para.text.strip()
    return any(n in txt for n in needles)

def get_table_rows(table):
    return [r for r in table.rows]

# ============================================================
# 1. MARK PARAGRAPHS WITH INCORRECT CLAIMS
# ============================================================
paragrafos_a_marcar = [
    # (needles, explanation, correction)
    (["logros desbloqueables", "logros", "Achievement", "achievements"],
     "Los logros/achievements solo existen en backend parcial (4/7 reglas, sin endpoint REST, sin frontend, sin integraci\u00f3n)",
     "Los logros desbloqueables se encuentran implementados \u00fanicamente en el backend de forma parcial (4 de 7 reglas: FIRST_QUIZ, PERFECT_SCORE, POINTS_1000, POINTS_5000). No existe endpoint REST para consultarlos ni componente frontend que los visualice. La integraci\u00f3n backend-frontend no est\u00e1 implementada."),
    (["Notification", "notificaciones"],
     "El m\u00f3dulo de notificaciones tiene la entidad definida pero todos los casos de uso, controladores y gateways est\u00e1n vac\u00edos",
     "El m\u00f3dulo de notificaciones se encuentra en estado de esqueleto: la entidad Notification existe en el dominio, pero los casos de uso, el controlador SSE y el gateway WebSocket son archivos vac\u00edos sin implementaci\u00f3n funcional."),
    (["7 suites de integracion", "7 suites de integraci\u00f3n"],
     "6 de los 7 archivos de pruebas de integraci\u00f3n del frontend est\u00e1n vac\u00edos (0 bytes)",
     "El documento afirma que existen 7 suites de integraci\u00f3n en el frontend, sin embargo 6 de los 7 archivos (AuthFlow.test.tsx, QuizPage.test.tsx, QuizPlay.test.tsx, FeedbackPanel.test.tsx, AssistantChat.test.tsx, Leaderboard.test.tsx) se encuentran vac\u00edos sin pruebas implementadas."),
    (["Eliminar mi cuenta", "deleteAccount", "eliminar cuenta"],
     "El endpoint DELETE /profile/me existe en backend pero no hay ning\u00fan componente frontend que implemente la eliminaci\u00f3n de cuenta",
     "La funcionalidad de eliminaci\u00f3n de cuenta solo est\u00e1 implementada en el backend (DELETE /profile/me). El frontend no contiene ning\u00fan componente, formulario ni flujo de navegaci\u00f3n que permita al usuario eliminar su cuenta."),
]

for para in doc.paragraphs:
    txt = para.text.strip().lower()
    for needles, explanation, correction in paragrafos_a_marcar:
        if any(n.lower() in txt for n in needles):
            paint_paragraph(para, RED)
            log.append(f"ROJO parr: {para.text[:80]}...")
            add_paragraph_after(para, f"[CORRECCI\u00d3N] {correction}", PURPLE, bold=True)
            add_paragraph_after(para, f"[EXPLICACI\u00d3N T\u00c9CNICA] {explanation}", ORANGE)
            break

# ============================================================
# 2. AUDIT TABLES
# ============================================================

# --- Table 27: Matriz de Casos de Prueba ---
# Check for empty test files
t27 = doc.tables[27]  # 10x5: TIPO | TECNOLOGIA | DESCRIPCION | HERRAMIENTA | COBERTURA
# No direct row coloring needed for this table - it's a plan, not results

# --- Table 28: Frontend Unit Tests ---
# All 28 suites passed - mark GREEN

# --- Table 29: Frontend Integration Tests ---
t29 = doc.tables[29]  # 8x2: ARCHIVO | FUNCIONALIDAD
empty_fe_int = ["AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
                "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx"]
for row in t29.rows[1:]:
    filename = row.cells[0].text.strip()
    if any(e in filename for e in empty_fe_int):
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.color.rgb = RED
        log.append(f"ROJO T29 fila: {filename}")

# --- Table 30: Frontend Functional Tests ---
t30 = doc.tables[30]  # 7x2
empty_fe_func = ["session-expiry.spec.ts"]
for row in t30.rows[1:]:
    filename = row.cells[0].text.strip()
    if any(e in filename for e in empty_fe_func):
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.color.rgb = RED
        log.append(f"ROJO T30 fila: {filename}")

# --- Table 31: Backend Unit Tests ---
# All seem implemented - check if app.controller.spec.ts is listed
t31 = doc.tables[31]
existing_be = {r.cells[0].text.strip() for r in t31.rows}
if not any("app.controller.spec.ts" in e for e in existing_be):
    new_row = t31.add_row()
    new_row.cells[0].text = "src/app.controller.spec.ts"
    new_row.cells[1].text = "Controlador principal de la aplicaci\u00f3n (1 caso)"
    for cell in new_row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = BLUE
    log.append("AZUL T31: agregada fila src/app.controller.spec.ts")

# --- Table 32: Backend Integration Tests ---
t32 = doc.tables[32]  # 9x2
# Verify notifications/sse.integration.spec.ts is listed
existing_be_int = {r.cells[0].text.strip() for r in t32.rows}
if not any("sse.integration" in e for e in existing_be_int):
    new_row = t32.add_row()
    new_row.cells[0].text = "tests/integration/notifications/sse.integration.spec.ts"
    new_row.cells[1].text = "Canal SSE de notificaciones (6 casos, 3 implementados + 3 pendientes)"
    for cell in new_row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = BLUE
    log.append("AZUL T32: agregada fila sse.integration.spec.ts")

# --- Table 33: Backend API Usability Tests ---
t33 = doc.tables[33]  # 5x2
# Verify all files listed
existing_be_usa = {r.cells[0].text.strip() for r in t33.rows}
expected_usa = ["api-versioning.spec.ts", "error-messages.spec.ts", "response-envelope.spec.ts", "swagger-contract.spec.ts"]
for e in expected_usa:
    if not any(e in x for x in existing_be_usa):
        log.append(f"INFO T33: falta {e}")

# --- Table 34: IA Microservice Tests ---
# Already looks complete from extracted text

# --- Table 35: Consolidated Results ---
t35 = doc.tables[35]  # 5x5
# Update result counts if needed

# ============================================================
# 3. ADD "Resultados de la Auditoría" SECTION
# ============================================================
audit_section = """
Resultados de la Auditor\u00eda

1. Funcionalidades completamente verificadas (backend + frontend + integraci\u00f3n):
- Registro de usuarios: RegisterUseCase + /auth/register + RegisterForm
- Inicio de sesi\u00f3n: LoginUseCase + /auth/login + LoginForm + OAuth Google/Microsoft
- Recuperaci\u00f3n de contrase\u00f1a: RequestPasswordResetUseCase + ResetPasswordUseCase
- Creaci\u00f3n de evaluaciones: CRUD quizzes con roles TEACHER+
- Generaci\u00f3n preguntas IA: QwenProvider + MistralProvider con fallback
- Resoluci\u00f3n evaluaciones: StartSession + SubmitAnswer + EndSession
- Calificaci\u00f3n autom\u00e1tica: integraci\u00f3n con FastAPI grading
- Leaderboard: GET /score/leaderboard con cach\u00e9 60s Redis
- Historial puntajes: GET /score/history y GET /score/history/:userId
- Administraci\u00f3n usuarios: CRUD ADMIN via /users
- Perfil usuario: GET/PATCH /profile/me, /profile/[username]
- Retroalimentaci\u00f3n IA: FeedbackPanel + WeaknessChart + AssistantChat
- Persistencia feedback_ia: SaveFeedbackUseCase en SubmitAnswerFlow
- Pruebas unitarias frontend: 28 suites, 170 pruebas
- Pruebas unitarias backend: 31 suites, ~152 pruebas
- Pruebas unitarias IA: ~120 pruebas

2. Funcionalidades documentadas pero NO implementadas:
- Logros desbloqueables: backend parcial (4/7 reglas, sin API REST, sin frontend)
- Pruebas integraci\u00f3n frontend: 6 de 7 archivos vac\u00edos
- Pruebas funcionales frontend: 1 archivo vac\u00edo (session-expiry)
- Eliminaci\u00f3n de cuenta: backend sin frontend
- Notificaciones en tiempo real: m\u00f3dulo vac\u00edo
- Pruebas rendimiento/carga: planificadas no ejecutadas

3. Funcionalidades implementadas pero NO documentadas:
- Rate limiting global (ThrottlerModule)
- Cach\u00e9 leaderboard (CacheModule TTL 60s)
- Prueba SSE notifications (3 casos implementados)
- Feedback_ia persistence (SaveFeedbackUseCase)

4. Hallazgos principales:
1. Documento afirma '7 suites de integraci\u00f3n' pero 6 archivos est\u00e1n vac\u00edos.
2. Logros mencionados como implementados pero solo existe backend parcial.
3. Eliminaci\u00f3n de cuenta documentada pero sin frontend.
4. Notificaciones referenciadas como funcionales pero m\u00f3dulo vac\u00edo.
5. Tablas diccionario de datos: Tabla 17 (Achievements) no debiera incluirse como funcionalidad completa.
""".strip()

# Find end of document and append audit section
# Add after the last paragraph
last_para = doc.paragraphs[-1]
for line in audit_section.split('\n'):
    if line.strip():
        p = add_paragraph_after(last_para, line.strip(), BLACK)
        last_para = p

log.append("A\u00d1ADIDA secci\u00f3n Resultados de la Auditor\u00eda al final")

# ============================================================
# 4. SAVE
# ============================================================
doc.save(SRC)
print(f"Respaldo guardado: {BACKUP}")
print(f"Documento actualizado: {SRC}")
print(f"\nCambios realizados ({len(log)}):")
for l in log:
    print(f"  {l}")
