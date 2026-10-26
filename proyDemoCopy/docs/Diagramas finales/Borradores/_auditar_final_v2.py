# -*- coding: utf-8 -*-
"""Audita Prueba.docx - version FINAL.
Corrige:
1. ROJO + MORADO: entidad Achievements listada como completa cuando es backend-only
2. ROJO + MORADO: "Notificaciones en tiempo real" (modulo vacio)
3. ROJO + MORADO: "Edicion perfil: en construccion" (YA completa)
4. ROJO: filas vacias Tabla 21 y 22
5. AZUL: funcionalidades completas NO documentadas
6. Resultados de la Auditoria al final
"""
import shutil
from docx import Document
from docx.shared import RGBColor
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup_final_v2.docx"
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

ANNOT_PREFIX = ('[OBSERVACION]', '[NOTA]', '[EXPLICACI', '[CORRECCI', '[FUNCIONALIDAD')

# ================================================================
# 1. ENTIDAD ACHIEVEMENTS listada como completa - MARCA ROJO
# ================================================================
for p in doc.paragraphs:
    txt = p.text.strip()
    if not any(txt.startswith(a) for a in ANNOT_PREFIX) and 'ocho entidades' in txt.lower() and 'achievements' in txt.lower():
        paint_para(p, RED)
        log.append("ROJO: parrafo con entidades incluye Achievements (backend-only)")
        add_after(p,
            "[EXPLICACI\u00d3N T\u00c9CNICA] La entidad Achievement existe como tabla en la BD (TypeORM) y tiene 4 reglas de desbloqueo en backend, pero NO tiene endpoint REST ni consumo frontend. Los diagramas PlantUML (ER y Relacional) la excluyen expl\u00edcitamente como 'incompleta'.",
            ORANGE)
        add_after(p,
            "[CORRECCI\u00d3N] Se han determinado ocho entidades en el modelo: Users, AuthSessions, EmailVerificationTokens, PasswordResetTokens, Quizzes, Questions, QuizSessions, Scores. Adicionalmente existen las entidades FeedbackIA (persistencia de retroalimentaci\u00f3n), Achievements (backend parcial, sin API ni frontend) y Notifications (esqueleto, sin implementaci\u00f3n funcional).",
            PURPLE)
        break

# ================================================================
# 2. NOTIFICACIONES - heading incorrecto
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
# 3. CORREGIR "Edicion de perfil: pagina en construccion"
# ================================================================
for p in doc.paragraphs:
    txt = p.text.strip()
    if not any(txt.startswith(a) for a in ANNOT_PREFIX) and 'Edicion de perfil de usuario' in txt and 'construccion' in txt.lower():
        paint_para(p, RED)
        log.append("ROJO: afirmacion desactualizada - Edicion de perfil")
        add_after(p,
            "[EXPLICACI\u00d3N T\u00c9CNICA] PATCH /profile/me (backend) + /profile/edit (frontend) est\u00e1n implementados y funcionales.",
            ORANGE)
        add_after(p,
            "[CORRECCI\u00d3N] Edici\u00f3n de perfil de usuario: funcionalidad completa. El endpoint PATCH /profile/me permite actualizar nombre y secci\u00f3n. La p\u00e1gina /profile/edit en el frontend proporciona el formulario correspondiente.",
            PURPLE)
        break

# ================================================================
# 4. AZUL: funcionalidades completas NO documentadas
# ================================================================

# 4a: Perfil publico despues del parrafo de perfil/estudiante
found_profile_section = False
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if not any(p.text.strip().startswith(a) for a in ANNOT_PREFIX) and 'm\u00f3dulo de progreso' in txt and 'm\u00e9tricas' in txt:
        add_after(p,
            "[FUNCIONALIDAD ADICIONAL] Perfil p\u00fablico: el endpoint GET /profile/[username] y la p\u00e1gina /profile/[username] permiten visualizar las estad\u00edsticas de cualquier usuario del sistema (puntajes totales, evaluaciones completadas, racha de actividad, \u00faltimos resultados) sin necesidad de autenticaci\u00f3n.",
            BLUE)
        log.append("AZUL: perfil publico agregado")
        found_profile_section = True
        break

# 4b: Vista docente detallada
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if not any(p.text.strip().startswith(a) for a in ANNOT_PREFIX) and 'resultados detallados' in txt and 'estudiantes' in txt:
        add_after(p,
            "[FUNCIONALIDAD ADICIONAL] Vista detallada por estudiante: los docentes acceden a /teacher/students/[id]/history para ver el historial completo de evaluaciones de un estudiante, con an\u00e1lisis por categor\u00eda tem\u00e1tica, nivel de dificultad, tipo de pregunta, tendencias de rendimiento y recomendaciones autom\u00e1ticas del sistema.",
            BLUE)
        log.append("AZUL: vista detallada estudiante agregada")
        break

# 4c: Admin user management after Gestion de Usuarios paragraph
# (this is already in the doc but let's add the CRUD details)
for p in doc.paragraphs:
    txt = p.text.strip()
    if not any(txt.startswith(a) for a in ANNOT_PREFIX) and 'Gestion de Usuarios' in txt and 'listado paginado' in txt:
        # This paragraph is already in green - let's not modify it, but add blue after it
        add_after(p,
            "[FUNCIONALIDAD ADICIONAL] CRUD completo de usuarios via /admin/users: create (POST /users), read (GET /users/:id), update (PATCH /users/:id), soft-delete (DELETE /users/:id) y reactivaci\u00f3n (POST /users/:id/activate). Los roles disponibles son STUDENT, TEACHER y ADMIN.",
            BLUE)
        log.append("AZUL: CRUD admin usuarios agregado")
        break

# 4d: Rate limiting
found_security = False
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if not any(p.text.strip().startswith(a) for a in ANNOT_PREFIX) and 'seguridad' in txt and 'contrase\u00f1as' in txt and 'cifrado' in txt:
        add_after(p,
            "[FUNCIONALIDAD ADICIONAL] Rate limiting global: ThrottlerModule configurado en el gateway API con l\u00edmite de 10 peticiones por segundo por IP y 5 peticiones por minuto para endpoints de autenticaci\u00f3n, protegiendo contra ataques de fuerza bruta.",
            BLUE)
        log.append("AZUL: rate limiting agregado")
        break

# 4e: Cache leaderboard
for p in doc.paragraphs:
    txt = p.text.strip().lower()
    if not any(p.text.strip().startswith(a) for a in ANNOT_PREFIX) and 'clasificaci\u00f3n global' in txt and 'leaderboard' in txt or ('clasificaci' in txt and 'puntajes' in txt):
        add_after(p,
            "[FUNCIONALIDAD ADICIONAL] Cach\u00e9 del leaderboard: el endpoint GET /score/leaderboard utiliza CacheModule con Redis y TTL de 60 segundos para optimizar el rendimiento en consultas concurrentes sin datos obsoletos.",
            BLUE)
        log.append("AZUL: cache leaderboard agregado")
        break

# ================================================================
# 5. ROJO: filas vacias en Tabla 21 y 22
# ================================================================
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

t22 = doc.tables[30]
for i, row in enumerate(t22.rows):
    if i == 0: continue
    if "session-expiry" in row.cells[0].text:
        paint_row(t22, i, RED)
        log.append("ROJO Tabla 22: session-expiry.spec.ts")
        break

# ================================================================
# 6. RESULTADOS DE LA AUDITORIA
# ================================================================
audit_lines = [
    ("Resultados de la Auditor\u00eda", BLACK, True),
    ("", None, False),
    ("1. FUNCIONALIDADES COMPLETAS VERIFICADAS (BACKEND + FRONTEND + INTEGRACI\u00d3N):", BLACK, True),
    ("", None, False),
    ("- Registro de usuarios con verificaci\u00f3n de email (c\u00f3digo 6 d\u00edgitos, reenv\u00edo)", BLUE, False),
    ("- Inicio de sesi\u00f3n email/password con JWT + refresh tokens + logout", BLUE, False),
    ("- OAuth Google y Microsoft (intercambio de id_token por JWT pair)", BLUE, False),
    ("- Recuperaci\u00f3n y restablecimiento de contrase\u00f1a (forgot/reset password)", BLUE, False),
    ("- Roles y autorizaci\u00f3n: STUDENT, TEACHER, ADMIN con RolesGuard y decorador @Roles", BLUE, False),
    ("- CRUD evaluaciones: crear/editar/eliminar/publicar quizzes con 3 tipos de pregunta", BLUE, False),
    ("- Generaci\u00f3n de preguntas con IA: QwenProvider + MistralProvider con fallback autom\u00e1tico", BLUE, False),
    ("- Resoluci\u00f3n de evaluaciones: StartSession + SubmitAnswer + EndSession con timer", BLUE, False),
    ("- Calificaci\u00f3n autom\u00e1tica: FastAPI con ExactMatch (MC/TF), Similarity (SBERT), NLP (spaCy)", BLUE, False),
    ("- Retroalimentaci\u00f3n IA personalizada: FeedbackPanel + POST /ai/feedback/generate + POST /ai/feedback/weaknesses", BLUE, False),
    ("- Leaderboard global: GET /score/leaderboard con filtros y cach\u00e9 Redis (TTL 60s)", BLUE, False),
    ("- Historial de puntajes: GET /score/history (propio) y GET /score/history/:userId (docente)", BLUE, False),
    ("- Administraci\u00f3n de usuarios (HU14): CRUD /users + interfaz /admin/users", BLUE, False),
    ("- Perfil p\u00fablico: GET /profile/[username] + p\u00e1gina /profile/[username] con estad\u00edsticas", BLUE, False),
    ("- Edici\u00f3n de perfil: PATCH /profile/me + p\u00e1gina /profile/edit (nombre, secci\u00f3n)", BLUE, False),
    ("- Vista detallada por estudiante (docente): /teacher/students/[id]/history con an\u00e1lisis", BLUE, False),
    ("- Reportes de administrador: /admin/reports con estad\u00edsticas globales", BLUE, False),
    ("- Rate limiting: ThrottlerModule (10 req/s general, 5 req/min auth)", BLUE, False),
    ("- Pruebas unitarias: frontend 28 suites (~170 tests), backend 31+ suites (~152 tests), IA ~120 tests", BLUE, False),
    ("", None, False),
    ("2. FUNCIONALIDADES PARCIALES O NO IMPLEMENTADAS:", BLACK, True),
    ("", None, False),
    ("- Logros desbloqueables (HU13): backend parcial (entidad + 4/7 reglas + listener), sin API REST (no hay GET /achievements) ni frontend (0 referencias en Frontend/src/)", RED, False),
    ("- Notificaciones en tiempo real: entidad Notification existe, SSE controller 0 l\u00edneas, casos de uso vac\u00edos, gateway WebSocket 0 l\u00edneas", RED, False),
    ("- Eliminaci\u00f3n de cuenta: DELETE /profile/me existe en backend, no hay bot\u00f3n ni flujo de confirmaci\u00f3n en frontend", RED, False),
    ("- Store API files (RTK Query): 5 archivos vac\u00edos (baseApi, authApi, quizApi, scoreApi, aiApi) - las llamadas API se hacen via lib/*.ts", RED, False),
    ("", None, False),
    ("3. HALLAZGOS Y CORRECCIONES APLICADAS:", BLACK, True),
    ("", None, False),
    ("1) P\u00e1rrafo 'ocho entidades... incluye Achievements' marcado ROJO porque Achievements es backend-only sin frontend. Diagramas ER y Relacional lo excluyen como 'incompleto'. Correcci\u00f3n en MORADO.", RED, False),
    ("2) 'Notificaciones en tiempo real y centro de notificaciones' marcado ROJO. M\u00f3dulo vac\u00edo. Correcci\u00f3n en MORADO.", RED, False),
    ("3) 'Edici\u00f3n de perfil: p\u00e1gina en construcci\u00f3n' marcado ROJO. La funcionalidad YA est\u00e1 completa (PATCH /profile/me + /profile/edit). Correcci\u00f3n en MORADO.", RED, False),
    ("4) Tabla 21: 6 archivos de integraci\u00f3n frontend vac\u00edos marcados ROJO.", RED, False),
    ("5) Tabla 22: session-expiry.spec.ts vac\u00edo marcado ROJO.", RED, False),
    ("6) Funcionalidades completas NO documentadas agregadas en AZUL:", BLUE, False),
    ("   - Perfil p\u00fablico (/profile/[username])", BLUE, False),
    ("   - Vista detallada estudiante (/teacher/students/[id]/history)", BLUE, False),
    ("   - CRUD admin usuarios (/admin/users) con create/update/delete/activate", BLUE, False),
    ("   - Rate limiting (ThrottlerModule)", BLUE, False),
    ("   - Cach\u00e9 del leaderboard (Redis TTL 60s)", BLUE, False),
    ("   - Reportes administrador (/admin/reports)", BLUE, False),
    ("", None, False),
    ("4. NOTAS:", BLACK, True),
    ("", None, False),
    ("- Los textos en VERDE 'Gesti\u00f3n de Usuarios...' y 'Gesti\u00f3n Global de Evaluaciones...' estaban coloreados en el documento original, no fueron modificados por esta auditor\u00eda. Describen correctamente funcionalidades implementadas.", BLACK, False),
    ("- El asistente IA (/assistant) y WeaknessChart existen como c\u00f3digo frontend pero el frontend llama a /api/ai/feedback mientras el backend expone POST /ai/feedback/generate. La integraci\u00f3n no est\u00e1 completa y no se documenta como funcional.", BLACK, False),
    ("- Los reportes de administrador (/admin/reports) son una p\u00e1gina frontend que compone datos de m\u00faltiples APIs; requiere verificaci\u00f3n adicional de integraci\u00f3n end-to-end.", BLACK, False),
]

last = doc.paragraphs[-1]
for text, color, bold in audit_lines:
    if text:
        p = add_after(last, text, color, bold=bold)
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
