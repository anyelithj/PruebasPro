# -*- coding: utf-8 -*-
"""Audita Prueba.docx - enfoque minimalista y preciso.
- Solo marca ROJO: seccion "Notificaciones en tiempo real" (afirmacion falsa) y filas de pruebas vacias.
- Agrega seccion Resultados de la Auditoria al final.
- No toca parrafos que describen correctamente el sistema o usan tiempo futuro.
"""
import shutil
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup_auditoria_final.docx"
shutil.copy(SRC, BACKUP)

RED    = RGBColor(0xFF, 0x00, 0x00)
PURPLE = RGBColor(0x80, 0x00, 0x80)
ORANGE = RGBColor(0xFF, 0x8C, 0x00)
BLUE   = RGBColor(0x00, 0x00, 0xFF)
BLACK  = RGBColor(0x00, 0x00, 0x00)

doc = Document(SRC)
log = []

def add_paragraph_after(para, text, color=None, bold=False):
    new_p_elem = OxmlElement('w:p')
    para._element.addnext(new_p_elem)
    new_para = type(para)(new_p_elem, doc)
    run = new_para.add_run(text)
    if color:
        run.font.color.rgb = color
    if bold:
        run.font.bold = True
    return new_para

def paint_para_red(para):
    for run in para.runs:
        run.font.color.rgb = RED

# ============================================================
# 1. MARCAR "Notificaciones en tiempo real y centro de notificaciones"
# ============================================================
for para in doc.paragraphs:
    txt = para.text.strip()
    if txt == "Notificaciones en tiempo real y centro de notificaciones":
        paint_para_red(para)
        log.append(f"ROJO: '{txt}'")
        add_paragraph_after(para,
            "[EXPLICACI\u00d3N T\u00c9CNICA] El m\u00f3dulo de notificaciones tiene la entidad Notification definida, pero los casos de uso, controlador SSE y gateway WebSocket son archivos vac\u00edos sin implementaci\u00f3n funcional.",
            ORANGE)
        add_paragraph_after(para,
            "[CORRECCI\u00d3N] Notificaciones en tiempo real (propuesta): la entidad Notification existe en el dominio, pero los casos de uso y el controlador SSE carecen de implementaci\u00f3n. No existe un centro de notificaciones funcional en el frontend.",
            PURPLE)
        break

# ============================================================
# 2. MARCAR FILAS VACIAS EN TABLAS DE PRUEBAS
# ============================================================
t29 = doc.tables[29]
empty_int = ["AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
             "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx"]
for i, row in enumerate(t29.rows):
    if i == 0:
        continue
    for e in empty_int:
        if e in row.cells[0].text:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.color.rgb = RED
            log.append(f"ROJO T29: {e}")
            break

t30 = doc.tables[30]
for i, row in enumerate(t30.rows):
    if i == 0:
        continue
    if "session-expiry" in row.cells[0].text:
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.color.rgb = RED
        log.append(f"ROJO T30: session-expiry.spec.ts")
        break

# ============================================================
# 3. AGREGAR RESULTADOS DE LA AUDITORIA
# ============================================================
audit_lines = [
    ("Resultados de la Auditor\u00eda", True, False),
    ("", False, False),
    ("1. Funcionalidades completamente verificadas (backend + frontend + integraci\u00f3n):", True, False),
    ("- Registro de usuarios", False, True),
    ("- Inicio de sesi\u00f3n (incluye OAuth Google/Microsoft)", False, True),
    ("- Recuperaci\u00f3n y verificaci\u00f3n de email", False, True),
    ("- CRUD de evaluaciones (quizzes) con roles TEACHER+", False, True),
    ("- Generaci\u00f3n de preguntas con IA (Qwen + Mistral fallback)", False, True),
    ("- Resoluci\u00f3n de evaluaciones y calificaci\u00f3n autom\u00e1tica", False, True),
    ("- Leaderboard global con cach\u00e9 Redis", False, True),
    ("- Historial de puntajes p\u00fablico", False, True),
    ("- Administraci\u00f3n de usuarios (ADMIN)", False, True),
    ("- Perfil p\u00fablico y edici\u00f3n de perfil", False, True),
    ("- Retroalimentaci\u00f3n IA (FeedbackPanel + WeaknessChart + AssistantChat)", False, True),
    ("- Persistencia de feedback_ia en SubmitAnswerFlow", False, True),
    ("- Rate limiting global (ThrottlerModule)", False, True),
    ("- Pruebas unitarias (frontend 28, backend 31, IA ~120)", False, True),
    ("", False, False),
    ("2. Funcionalidades documentadas pero NO implementadas (o parciales):", True, False),
    ("- Logros desbloqueables (HU13): backend parcial (4/7 reglas, sin API REST, sin frontend)", False, False),
    ("- Notificaciones en tiempo real: entidad existe, implementaci\u00f3n vac\u00eda", False, False),
    ("- Eliminaci\u00f3n de cuenta: endpoint backend existe, frontend ausente", False, False),
    ("- Pruebas integraci\u00f3n frontend: 6 de 7 archivos vac\u00edos", False, False),
    ("- Pruebas funcionales: session-expiry.spec.ts vac\u00edo", False, False),
    ("- Pruebas de rendimiento/carga: planificadas no ejecutadas", False, False),
    ("", False, False),
    ("3. Funcionalidades implementadas NO documentadas:", True, False),
    ("- Rate limiting: ThrottlerModule en gateway (no mencionado)", False, True),
    ("- Cach\u00e9 leaderboard: CacheModule + Redis TTL 60s (no mencionado)", False, True),
    ("- Persistencia feedback_ia en historial: SaveFeedbackUseCase (no documentado)", False, True),
    ("", False, False),
    ("4. Hallazgos principales:", True, False),
    ("1) 7 suites integraci\u00f3n frontend: 6 archivos vac\u00edos (AuthFlow, QuizPage, QuizPlay, FeedbackPanel, AssistantChat, Leaderboard). Solo api.service.spec.ts tiene pruebas.", False, False),
    ("2) Logros desbloqueables: backend parcial (4/7 reglas) sin API ni frontend. No debieran listarse como completos.", False, False),
    ("3) Eliminaci\u00f3n de cuenta: endpoint backend sin interfaz de usuario.", False, False),
    ("4) Notificaciones tiempo real: m\u00f3dulo vac\u00edo pese a mencionarse como funcionalidad.", False, False),
    ("5) No se documentan: rate limiting, cach\u00e9 Redis, persistencia feedback_ia.", False, False),
]

last_para = doc.paragraphs[-1]
for text, is_bold, is_blue in audit_lines:
    if text:
        p = add_paragraph_after(last_para, text, BLUE if is_blue else BLACK, bold=is_bold)
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
