# -*- coding: utf-8 -*-
"""Audita Prueba.docx - version corregida.
SOLO cambios verificados:
- ROJO en notificaciones (heading incorrecto)
- ROJO en pruebas vacias (Tabla 21 y 22)
- AZUL solo para features 100% COMPLETAS end-to-end
- PURPLE para correcciones de afirmaciones desactualizadas
- Seccion Resultados de la Auditoria al final
"""
import shutil
from docx import Document
from docx.shared import RGBColor
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup_corregido.docx"
shutil.copy(SRC, BACKUP)

RED    = RGBColor(0xFF, 0x00, 0x00)
BLUE   = RGBColor(0x00, 0x00, 0xFF)
PURPLE = RGBColor(0x80, 0x00, 0x80)
ORANGE = RGBColor(0xFF, 0x8C, 0x00)
BLACK  = RGBColor(0x00, 0x00, 0x00)

doc = Document(SRC)
log = []

def add_after(para, text, color=None, bold=False):
    el = OxmlElement('w:p')
    para._element.addnext(el)
    np = type(para)(el, doc)
    r = np.add_run(text)
    if color: r.font.color.rgb = color
    if bold: r.font.bold = True
    return np

def paint_para(para, color):
    for run in para.runs:
        run.font.color.rgb = color

def paint_row(table, row_idx, color):
    for cell in table.rows[row_idx].cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = color

# ================================================================
# 1. NOTIFICACIONES - heading incorrecto
# ================================================================
for p in doc.paragraphs:
    if p.text.strip() == "Notificaciones en tiempo real y centro de notificaciones":
        paint_para(p, RED)
        log.append("ROJO: Notificaciones en tiempo real")
        add_after(p,
            "[EXPLICACI\u00d3N T\u00c9CNICA] El m\u00f3dulo de notificaciones tiene entidad Notification pero el controlador SSE (0 l\u00edneas), casos de uso y gateway WebSocket est\u00e1n vac\u00edos.",
            ORANGE)
        add_after(p,
            "[CORRECCI\u00d3N] Notificaciones en tiempo real y centro de notificaciones (propuesta): la entidad Notification existe en el dominio pero los casos de uso y controlador SSE carecen de implementaci\u00f3n funcional.",
            PURPLE)
        break

# ================================================================
# 2. CORREGIR "Edicion de perfil: pagina en construccion"
#    La pagina de edicion de perfil YA existe y funciona.
# ================================================================
for p in doc.paragraphs:
    txt = p.text.strip()
    if "Edicion de perfil de usuario" in txt and "construccion" in txt.lower():
        paint_para(p, RED)
        log.append("ROJO: afirmacion desactualizada - Edicion de perfil")
        add_after(p,
            "[EXPLICACI\u00d3N T\u00c9CNICA] El endpoint PATCH /profile/me (78 l\u00edneas) y la p\u00e1gina /profile/edit (101 l\u00edneas) est\u00e1n implementados y funcionales. La afirmaci\u00f3n 'p\u00e1gina en construcci\u00f3n' estaba desactualizada.",
            ORANGE)
        add_after(p,
            "[CORRECCI\u00d3N] Edici\u00f3n de perfil de usuario: funcionalidad completa. El endpoint PATCH /profile/me permite actualizar nombre y secci\u00f3n. La p\u00e1gina /profile/edit en el frontend proporciona el formulario de edici\u00f3n correspondiente.",
            PURPLE)
        break

# ================================================================
# 3. AZUL: funcionalidades 100% completas NO documentadas
#    Solo features con backend + frontend + integracion verificada
# ================================================================

# 3a: Perfil publico (GET /profile/[username] + ProfilePage)
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if "perfil" in txt and "progreso" in txt and "estad" in txt:
        add_after(p,
            "Perfil p\u00fablico: el endpoint GET /profile/[username] y la p\u00e1gina /profile/[username] permiten visualizar las estad\u00edsticas de cualquier usuario (puntajes, evaluaciones completadas, racha) sin autenticaci\u00f3n.",
            BLUE)
        log.append("AZUL: perfil publico agregado")
        break

# 3b: Vista detallada estudiante para docente
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if "resultados de sus estudiantes" in txt or "resultados de los estudiantes" in txt:
        add_after(p,
            "Vista detallada por estudiante: los docentes acceden a /teacher/students/[id]/history para ver el historial completo con an\u00e1lisis por categor\u00eda, dificultad y tendencias de rendimiento.",
            BLUE)
        log.append("AZUL: vista detallada estudiante agregada")
        break

# 3c: Administracion usuarios (HU14) - buscar seccion de admin
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if "administrador" in txt and "gestion" in txt and "usuario" in txt and "listado" in txt:
        add_after(p,
            "Gesti\u00f3n completa de usuarios: CRUD /users para ADMIN permite crear, editar, activar/desactivar usuarios y asignar roles (STUDENT/TEACHER/ADMIN) desde la interfaz /admin/users.",
            BLUE)
        log.append("AZUL: gestion usuarios admin agregada")
        break

# ================================================================
# 4. ROJO: filas vacias en Tabla 21 y Tabla 22
# ================================================================
# Tabla 21 = doc index 29 (Pruebas Integracion Frontend)
t21 = doc.tables[29]
empty_int = ["AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
             "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx"]
for i, row in enumerate(t21.rows):
    if i == 0: continue
    for e in empty_int:
        if e in row.cells[0].text:
            paint_row(t21, i, RED)
            log.append(f"ROJO Tabla 21: {e}")
            break

# Tabla 22 = doc index 30 (Pruebas Funcionales Frontend)
t22 = doc.tables[30]
for i, row in enumerate(t22.rows):
    if i == 0: continue
    if "session-expiry" in row.cells[0].text:
        paint_row(t22, i, RED)
        log.append("ROJO Tabla 22: session-expiry.spec.ts")
        break

# ================================================================
# 5. RESULTADOS DE LA AUDITORIA
# ================================================================
audit_lines = [
    ("Resultados de la Auditor\u00eda", True),
    ("", False),
    ("FUNCIONALIDADES VERIFICADAS (BACKEND + FRONTEND COMPLETOS):", True),
    ("", False),
    ("- Registro de usuarios con verificaci\u00f3n de email (6 d\u00edgitos)", False),
    ("- Inicio de sesi\u00f3n (email+password) con JWT + refresh tokens + logout", False),
    ("- OAuth Google y Microsoft (intercambio id_token por JWT)", False),
    ("- Recuperaci\u00f3n y restablecimiento de contrase\u00f1a", False),
    ("- Roles y autorizaci\u00f3n: STUDENT, TEACHER, ADMIN con RolesGuard y @Roles", False),
    ("- CRUD evaluaciones: crear/editar/eliminar/publicar quizzes con 3 tipos de pregunta", False),
    ("- Generaci\u00f3n de preguntas con IA: QwenProvider + MistralProvider con fallback", False),
    ("- Resoluci\u00f3n de evaluaciones: StartSession + SubmitAnswer + EndSession con timer", False),
    ("- Calificaci\u00f3n autom\u00e1tica (FastAPI): ExactMatch, Similarity, NLP + Strategy pattern", False),
    ("- Retroalimentaci\u00f3n IA: FeedbackPanel en resultados + POST /ai/feedback/* proxy a FastAPI", False),
    ("- Leaderboard global con filtros por periodo/secci\u00f3n", False),
    ("- Historial de puntajes: propio (GET /score/history) y de otros usuarios (GET /score/history/:userId)", False),
    ("- Administraci\u00f3n de usuarios (HU14): CRUD /users + interfaz /admin/users", False),
    ("- Perfil p\u00fablico: GET /profile/[username] + p\u00e1gina /profile/[username]", False),
    ("- Edici\u00f3n de perfil: PATCH /profile/me + p\u00e1gina /profile/edit", False),
    ("- Vista detallada por estudiante (docente): /teacher/students/[id]/history", False),
    ("- Rate limiting: ThrottlerModule en gateway (10 req/s general, 5 req/min auth)", False),
    ("- Pruebas unitarias: frontend 28 suites (~170 pruebas), backend 31+ suites (~152 pruebas), IA ~120 pruebas", False),
    ("", False),
    ("FUNCIONALIDADES PARCIALES O NO IMPLEMENTADAS:", True),
    ("", False),
    ("- Logros desbloqueables (HU13): backend parcial (entidad + 4/7 reglas), sin API REST ni frontend", False),
    ("- Notificaciones en tiempo real: entidad Notification existe, SSE controller 0 l\u00edneas, casos de uso vac\u00edos", False),
    ("- Eliminaci\u00f3n de cuenta: DELETE /profile/me en backend, sin bot\u00f3n ni flujo en frontend", False),
    ("- Store API files (RTK Query): 5 archivos vac\u00edos (baseApi, authApi, quizApi, scoreApi, aiApi)", False),
    ("", False),
    ("CORRECCIONES APLICADAS:", True),
    ("", False),
    ("1. 'Notificaciones en tiempo real y centro de notificaciones': marcado ROJO + correcci\u00f3n MORADO", False),
    ("2. 'Edici\u00f3n de perfil: p\u00e1gina en construcci\u00f3n': marcado ROJO + correcci\u00f3n MORADO (la edici\u00f3n YA est\u00e1 completa)", False),
    ("3. Tabla 21 (Pruebas Integraci\u00f3n Frontend): 6 archivos vac\u00edos marcados ROJO", False),
    ("4. Tabla 22 (Pruebas Funcionales Frontend): 1 archivo vac\u00edo marcado ROJO", False),
    ("5. Perfil p\u00fablico, vista detallada estudiante y gesti\u00f3n usuarios admin agregados en AZUL", False),
    ("", False),
    ("HALLAZGOS:", True),
    ("", False),
    ("1. El asistente IA (/assistant) y WeaknessChart existen como c\u00f3digo frontend pero su integraci\u00f3n con el backend no est\u00e1 completa (el frontend llama a /api/ai/feedback que no coincide con POST /ai/feedback/generate del backend). No se documentan como funcionalidad completa.", False),
    ("2. Los reportes de administrador (/admin/reports) son una p\u00e1gina frontend que compone datos de m\u00faltiples APIs; su integraci\u00f3n end-to-end requiere verificaci\u00f3n adicional.", False),
    ("3. Logros y notificaciones requieren desarrollo adicional significativo.", False),
]

last = doc.paragraphs[-1]
for text, is_bold in audit_lines:
    if text:
        p = add_after(last, text, BLACK, bold=is_bold)
        last = p
    else:
        p = add_after(last, '')
        last = p

log.append("SECCION: Resultados de la Auditor\u00eda agregada al final")

# SAVE
doc.save(SRC)
print(f"Respaldo: {BACKUP}")
print(f"Guardado: {SRC}")
print(f"\nCambios ({len(log)}):")
for l in log:
    print(f"  {l}")
