# -*- coding: utf-8 -*-
"""Audita Prueba.docx con color coding preciso.
- Solo marca parrafos ORIGINALES (sin prefijos [OBSERVACION]/[NOTA]) que hagan afirmaciones incorrectas.
- Agrega correcciones solo en parrafos originales.
- No duplica anotaciones existentes.
"""
import shutil, re
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup_auditoria_2.docx"
shutil.copy(SRC, BACKUP)

GREEN  = RGBColor(0x00, 0x80, 0x00)
RED    = RGBColor(0xFF, 0x00, 0x00)
PURPLE = RGBColor(0x80, 0x00, 0x80)
ORANGE = RGBColor(0xFF, 0x8C, 0x00)
BLUE   = RGBColor(0x00, 0x00, 0xFF)
BLACK  = RGBColor(0x00, 0x00, 0x00)

doc = Document(SRC)
log = []

ANNOTATION_PREFIXES = ['[OBSERVACION]', '[NOTA]', '[EXPLICACI', '[CORRECCI']

def is_original_paragraph(para):
    """True if paragraph does NOT already have an annotation prefix."""
    txt = para.text.strip()
    return not any(txt.startswith(p) for p in ANNOTATION_PREFIXES)

def add_paragraph_after(para, text, color=None, bold=False, size=None):
    new_p_elem = OxmlElement('w:p')
    para._element.addnext(new_p_elem)
    new_para = type(para)(new_p_elem, doc)
    run = new_para.add_run(text)
    if color:
        run.font.color.rgb = color
    if bold:
        run.font.bold = True
    if size:
        run.font.size = Pt(size)
    return new_para

def paint_table_row_red(table, row_idx):
    for cell in table.rows[row_idx].cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = RED

# ============================================================
# 1. MARK INCORRECT PARAGRAPHS
# ============================================================
# Only mark paragraphs that make STRONG POSITIVE claims about features 
# that are NOT actually implemented end-to-end

# Words indicating the paragraph is ALREADY correctly describing the limitation
LIMITATION_WORDS = ['parcial', 'pendiente', 'sin implementacion', 'sin api', 'sin frontend',
                    'CERO', 'no cumple', 'no existe', 'faltante', 'backend parcial',
                    'sin integraci', 'no hay componente', 'vacio', 'vací']

def seems_like_correct_observation(txt):
    """True if the paragraph already describes a limitation correctly."""
    return any(w in txt for w in LIMITATION_WORDS)

rules = [
    # (words_to_match, explanation_short, correction_text)
    # Rule: achievement claims (only paragraphs that claim achievements ARE implemented)
    (lambda txt: 'logros' in txt and any(w in txt for w in ['permite', 'implementa', 'incluye', 'completo', 'integrado', 'disponible', 'extiende', 'almacena', 'verifica', 'permite la']) and not seems_like_correct_observation(txt),
     "Los logros/achievements solo existen en backend parcial (4/7 reglas, sin endpoint REST, sin frontend, sin integraci\u00f3n)",
     "Los logros desbloqueables existen \u00fanicamente como backend parcial (4/7 reglas: FIRST_QUIZ, PERFECT_SCORE, POINTS_1000, POINTS_5000). No hay endpoint REST, ni componente frontend, ni integraci\u00f3n backend-frontend para esta funcionalidad."),
    # Rule: notification claims - only strong positive ones that claim it's implemented
    (lambda txt: ('notificacion' in txt or 'notificaciones' in txt) and any(w in txt for w in ['tiempo real', 'completo', 'implementad', 'notifica', 'notificaci\u00f3n en', 'funcional', 'disponible']) and 'propone' not in txt and not seems_like_correct_observation(txt),
     "El m\u00f3dulo de notificaciones est\u00e1 vac\u00edo: entidad existe, pero casos de uso, controlador y gateway no tienen implementaci\u00f3n funcional",
     "El m\u00f3dulo de notificaciones es un esqueleto: la entidad Notification existe, pero los casos de uso (CreateNotification, GetNotifications, MarkAsRead, DeleteNotification), el controlador SSE y el gateway WebSocket son archivos sin implementaci\u00f3n."),
    # Rule: delete account
    (lambda txt: any(w in txt for w in ['eliminar cuenta', 'eliminar mi cuenta', 'deleteAccount', 'eliminaci\u00f3n de cuenta']) and any(w in txt for w in ['disponible', 'permite', 'implement', 'complet']) and not seems_like_correct_observation(txt),
     "DELETE /profile/me existe en backend pero no hay componente frontend que lo implemente",
     "La eliminaci\u00f3n de cuenta solo existe en backend (DELETE /profile/me). No hay formulario, bot\u00f3n ni flujo frontend que permita al usuario eliminar su cuenta."),
    # Rule: 7 integration suites claim (only the original incorrect claim, not its correction)
    (lambda txt: '7 suite' in txt and 'integraci' in txt and not seems_like_correct_observation(txt),
     "6 de los 7 archivos de pruebas de integraci\u00f3n del frontend est\u00e1n vac\u00edos",
     "De las 7 suites de integraci\u00f3n listadas en el frontend, 6 archivos (AuthFlow.test.tsx, QuizPage.test.tsx, QuizPlay.test.tsx, FeedbackPanel.test.tsx, AssistantChat.test.tsx, Leaderboard.test.tsx) est\u00e1n vac\u00edos sin pruebas implementadas."),
]

for para in doc.paragraphs:
    if not is_original_paragraph(para):
        continue
    txt = para.text.lower().strip()
    # Skip very short paragraphs
    if len(txt) < 20:
        continue
    for match_fn, explanation, correction in rules:
        if match_fn(txt):
            # Mark original as RED
            for run in para.runs:
                run.font.color.rgb = RED
            log.append(f"ROJO: {para.text[:80]}...")
            # Insert explanation + correction after original
            add_paragraph_after(para, f"[EXPLICACI\u00d3N T\u00c9CNICA] {explanation}", ORANGE)
            add_paragraph_after(para, f"[CORRECCI\u00d3N] {correction}", PURPLE)
            break

# ============================================================
# 2. AUDIT TABLES
# ============================================================

# Table 29 (index 29): Frontend Integration Tests - mark empty rows
t29 = doc.tables[29]
empty_fe_int = ["AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
                "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx"]
for i, row in enumerate(t29.rows):
    if i == 0:
        continue
    filename = row.cells[0].text.strip()
    if any(e in filename for e in empty_fe_int):
        paint_table_row_red(t29, i)
        log.append(f"ROJO T29 fila {i}: {filename}")

# Table 30 (index 30): Frontend Functional Tests - mark empty rows
t30 = doc.tables[30]
empty_fe_func = ["session-expiry.spec.ts"]
for i, row in enumerate(t30.rows):
    if i == 0:
        continue
    filename = row.cells[0].text.strip()
    if any(e in filename for e in empty_fe_func):
        paint_table_row_red(t30, i)
        log.append(f"ROJO T30 fila {i}: {filename}")

# ============================================================
# 3. ADD AUDIT RESULTS SECTION
# ============================================================
audit_lines = [
    "Resultados de la Auditor\u00eda",
    "",
    "1. Funcionalidades completamente verificadas (backend + frontend + integraci\u00f3n):",
    "- Registro de usuarios: RegisterUseCase + /auth/register + RegisterForm",
    "- Inicio de sesi\u00f3n: LoginUseCase + /auth/login + LoginForm + OAuth Google/Microsoft",
    "- Recuperaci\u00f3n de contrase\u00f1a: RequestPasswordResetUseCase + ResetPasswordUseCase",
    "- Verificaci\u00f3n de email: VerifyEmailUseCase + c\u00f3digo 6 d\u00edgitos + reenv\u00edo",
    "- Creaci\u00f3n de evaluaciones: CRUD quizzes (crear/editar/eliminar) con roles TEACHER+",
    "- Generaci\u00f3n de preguntas con IA: QwenProvider + MistralProvider con fallback autom\u00e1tico",
    "- Resoluci\u00f3n de evaluaciones: StartSession / SubmitAnswer / EndSession",
    "- Calificaci\u00f3n autom\u00e1tica: integraci\u00f3n con FastAPI grading service",
    "- Leaderboard global: GET /score/leaderboard con Redis TTL 60s",
    "- Historial de puntajes: GET /score/history y GET /score/history/:userId (p\u00fablico)",
    "- Administraci\u00f3n de usuarios: CRUD completo via /users para rol ADMIN",
    "- Perfil p\u00fablico: GET /profile/[username] con estad\u00edsticas",
    "- Edici\u00f3n de perfil: PATCH /profile/me con avatar, biography, social links",
    "- Retroalimentaci\u00f3n IA: FeedbackPanel + WeaknessChart + AssistantChat (frontend)",
    "- Persistencia de feedback_ia: SaveFeedbackUseCase + SubmitAnswerFlow",
    "- Pruebas unitarias frontend: 28 suites, ~170 pruebas",
    "- Pruebas unitarias backend: 31 suites, ~152 pruebas",
    "- Pruebas unitarias microservicio IA: ~120 pruebas",
    "",
    "2. Funcionalidades documentadas pero NO implementadas (o solo parciales):",
    "- Logros desbloqueables (HU13): backend parcial (4/7 reglas, sin endpoint REST, sin frontend)",
    "- Pruebas de integraci\u00f3n frontend: 6 de 7 archivos vac\u00edos",
    "- Pruebas funcionales frontend: 1 archivo vac\u00edo (session-expiry)",
    "- Eliminaci\u00f3n de cuenta: endpoint backend existe, frontend ausente",
    "- Notificaciones en tiempo real: m\u00f3dulo entidad existe, implementaci\u00f3n vac\u00eda",
    "- Pruebas de rendimiento/carga: planificadas pero no ejecutadas",
    "",
    "3. Funcionalidades implementadas pero NO documentadas:",
    "- Rate limiting global: ThrottlerModule configurado en gateway",
    "- Cach\u00e9 de leaderboard: CacheModule con TTL 60s usando Redis",
    "- Prueba SSE notifications: 3 casos implementados en sse.integration.spec.ts",
    "- Persistencia feedback_ia: SaveFeedbackUseCase integrado en SubmitAnswerFlow",
    "",
    "4. Hallazgos principales:",
    "1) El documento afirma '7 suites de integraci\u00f3n' pero 6 archivos est\u00e1n vac\u00edos (0 bytes).",
    "2) Logros desbloqueables mencionados como implementados pero falta API REST y frontend completo.",
    "3) Eliminaci\u00f3n de cuenta tiene endpoint backend pero no interfaz de usuario.",
    "4) Notificaciones en tiempo real referenciadas como funcionales pero el m\u00f3dulo est\u00e1 vac\u00edo.",
    "5) El diccionario de datos incluye tabla achievements (correcto) pero no debiera listarse como funcionalidad completa.",
    "6) Rate limiting, cach\u00e9 Redis y persistencia de feedback_ia no est\u00e1n mencionados en el documento.",
]

last_para = doc.paragraphs[-1]
for line in audit_lines:
    if line.strip():
        p = add_paragraph_after(last_para, line.strip(), BLACK, bold=('Resultados' in line or line.startswith(('1.', '2.', '3.', '4.'))) and len(line) < 40)
        last_para = p
    else:
        p = add_paragraph_after(last_para, '')
        last_para = p

log.append("SECCI\u00d3N: Resultados de la Auditor\u00eda agregada al final")

# ============================================================
# 4. SAVE
# ============================================================
doc.save(SRC)
print(f"Respaldo: {BACKUP}")
print(f"Guardado: {SRC}")
print(f"\nCambios realizados ({len(log)}):")
for l in log:
    print(f"  {l}")
