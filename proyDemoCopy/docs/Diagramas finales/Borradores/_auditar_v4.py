# -*- coding: utf-8 -*-
"""Audita Prueba.docx - version completa y precisa.
Mapeo documentado: 'Tabla N' del documento -> python-docx table index.
"""
import shutil
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml import OxmlElement

BASE = "C:/Users/angui/Documents/proyectoBorrador/proyDemo/Diagramas finales"
SRC = f"{BASE}/prueba.docx"
BACKUP = f"{BASE}/prueba_backup.docx"
shutil.copy(SRC, BACKUP)

RED    = RGBColor(0xFF, 0x00, 0x00)
GREEN  = RGBColor(0x00, 0x80, 0x00)
BLUE   = RGBColor(0x00, 0x00, 0xFF)
PURPLE = RGBColor(0x80, 0x00, 0x80)
ORANGE = RGBColor(0xFF, 0x8C, 0x00)
BLACK  = RGBColor(0x00, 0x00, 0x00)
TEAL   = RGBColor(0x00, 0x70, 0xC0)

doc = Document(SRC)
log = []

def add_para_after(para, text, color=None, bold=False):
    el = OxmlElement('w:p')
    para._element.addnext(el)
    np = type(para)(el, doc)
    r = np.add_run(text)
    if color: r.font.color.rgb = color
    if bold: r.font.bold = True
    return np

def paint_all(para, color):
    for run in para.runs:
        run.font.color.rgb = color

def paint_row(table, row_idx, color):
    for cell in table.rows[row_idx].cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = color

# ================================================================
# SECCION 1: NOTIFICACIONES - marca el heading incorrecto
# ================================================================
for i, p in enumerate(doc.paragraphs):
    if p.text.strip() == "Notificaciones en tiempo real y centro de notificaciones":
        paint_all(p, RED)
        log.append("ROJO: Notificaciones en tiempo real y centro de notificaciones")
        add_para_after(p,
            "[EXPLICACI\u00d3N T\u00c9CNICA] El m\u00f3dulo de notificaciones tiene la entidad Notification pero los casos de uso, controlador SSE y gateway WebSocket est\u00e1n vac\u00edos.",
            ORANGE)
        add_para_after(p,
            "[CORRECCI\u00d3N] Notificaciones en tiempo real y centro de notificaciones (propuesta): la entidad Notification existe en el dominio, pero los casos de uso y el controlador SSE carecen de implementaci\u00f3n funcional. No existe centro de notificaciones en el frontend.",
            PURPLE)
        break

# ================================================================
# SECCION 2: TABLA 21 - PRUEBAS INTEGRACION FRONTEND
# Tabla 21 = doc index 29 = 8x2. Marcar filas vacias como ROJO.
# ================================================================
t21 = doc.tables[29]  # Tabla 21
empty_int = ["AuthFlow.test.tsx", "QuizPage.test.tsx", "QuizPlay.test.tsx",
             "FeedbackPanel.test.tsx", "AssistantChat.test.tsx", "Leaderboard.test.tsx"]
for i, row in enumerate(t21.rows):
    if i == 0: continue
    for e in empty_int:
        if e in row.cells[0].text:
            paint_row(t21, i, RED)
            log.append(f"ROJO Tabla 21 fila: {e}")
            break

# ================================================================
# SECCION 3: TABLA 22 - PRUEBAS FUNCIONALES FRONTEND
# Tabla 22 = doc index 30 = 7x2
# ================================================================
t22 = doc.tables[30]
for i, row in enumerate(t22.rows):
    if i == 0: continue
    if "session-expiry" in row.cells[0].text:
        paint_row(t22, i, RED)
        log.append("ROJO Tabla 22 fila: session-expiry.spec.ts")
        break

# ================================================================
# SECCION 4: AGREGAR TEXTO AZUL - FUNCIONALIDADES NO DOCUMENTADAS
# ================================================================

# 4a: Despues de la seccion de objetivos/alcance mencionar capacidades implementadas
# Buscar parrafo cerca de la seccion de objetivos
for i, p in enumerate(doc.paragraphs):
    txt = p.text.strip().lower()
    if "alcanzados satisfactoriamente" in txt or "objetivos espec" in txt:
        # This is near the conclusions - add blue after this section
        pass

# 4b: Agregar funcionalidades implementadas NO documentadas como AZUL
# Buscar el texto "Resultados de la Auditoria" existente y agregar items AZUL
for i, p in enumerate(doc.paragraphs):
    if p.text.strip().startswith("3. Funcionalidades implementadas pero NO documentadas"):
        # Add more items after this section
        add_para_after(p, "- Perfil p\u00fablico: GET /profile/[username] + ProfilePage en frontend", BLUE)
        add_para_after(p, "- Edici\u00f3n de perfil: PATCH /profile/me + EditProfilePage en frontend", BLUE)
        add_para_after(p, "- Administraci\u00f3n de usuarios (HU14): CRUD /users para ADMIN + UserAdminPage", BLUE)
        add_para_after(p, "- Persistencia de feedback_ia: SaveFeedbackUseCase en SubmitAnswerFlow", BLUE)
        log.append("AZUL: funcionalidades no documentadas agregadas")
        break

# 4c: Verificar si "profile/[username]" o perfil publico estan mencionados
found_profile = False
for p in doc.paragraphs:
    if "profile" in p.text.lower() and ("public" in p.text.lower() or "p\u00fablico" in p.text.lower()):
        found_profile = True
        break

if not found_profile:
    # Add after a relevant section - e.g., after the leaderboard section
    for i, p in enumerate(doc.paragraphs):
        txt = p.text.strip().lower()
        if "clasificaci\u00f3n global" in txt and "mejores puntajes" in txt:
            add_para_after(p, 
                "[FUNCIONALIDAD ADICIONAL] Perfil p\u00fablico: GET /profile/[username] expone estad\u00edsticas del usuario (puntajes, evaluaciones completadas, racha de actividad) sin requerir autenticaci\u00f3n. Edici\u00f3n de perfil: PATCH /profile/me permite actualizar avatar, biograf\u00eda y enlaces sociales.",
                BLUE)
            log.append("AZUL: perfil p\u00fablico agregado")
            break

# 4d: Verificar si rate limiting esta documentado
found_ratelimit = False
for p in doc.paragraphs:
    if "throttl" in p.text.lower() or "rate limit" in p.text.lower():
        found_ratelimit = True
        break

if not found_ratelimit:
    # Add after a relevant security paragraph
    for i, p in enumerate(doc.paragraphs):
        txt = p.text.strip().lower()
        if "contrase\u00f1as" in txt and "cifrado" in txt and "seguridad" in txt:
            add_para_after(p,
                "[FUNCIONALIDAD ADICIONAL] Rate limiting global: ThrottlerModule configurado en el gateway con l\u00edmites de 10 peticiones/segundo por IP y 5 peticiones/minuto para endpoints de autenticaci\u00f3n.",
                BLUE)
            log.append("AZUL: rate limiting agregado")
            break

# ================================================================
# SECCION 5: CORREGIR TEXTO SOBRE LOGROS - marcarlo como parcial
# ================================================================
for i, p in enumerate(doc.paragraphs):
    txt = p.text.strip().lower()
    # Skip already-annotated paragraphs
    if txt.startswith(('[observacion]', '[nota]', '[explicaci', '[correcci')):
        continue
    # Find paragraphs that describe achievements as a complete feature
    if 'logros' in txt and not any(w in txt for w in ['parcial', 'pendiente', 'no tiene', 'no hay', 'sin api', 'sin frontend', 'no cumpl', 'no existe']):
        if any(w in txt for w in ['completamente', 'implementad', 'funcionalidad completa', 'totalmente', 'integrad', 'disponible', 'funcional']):
            paint_all(p, RED)
            log.append(f"ROJO: afirmacion incorrecta sobre logros: {txt[:60]}...")
            add_para_after(p,
                "[EXPLICACI\u00d3N T\u00c9CNICA] Los logros desbloqueables son un feature parcial: entidad Achievement, 4/7 reglas en backend, sin endpoint REST, sin frontend.",
                ORANGE)
            add_para_after(p,
                "[CORRECCI\u00d3N] Los logros desbloqueables (HU13) se encuentran implementados parcialmente en el backend (entidad Achievement, 4 reglas: FIRST_QUIZ, PERFECT_SCORE, POINTS_1000, POINTS_5000). No existe endpoint REST para consultarlos ni componente frontend para visualizarlos. La integraci\u00f3n backend-frontend no est\u00e1 implementada.",
                PURPLE)
            break

# ================================================================
# SECCION 6: AGREGAR RESULTADOS DE LA AUDITORIA (final)
# ================================================================
audit = [
    ("Resultados de la Auditor\u00eda", BLACK, True),
    ("", None, False),
    ("1. Funcionalidades completamente verificadas (backend + frontend + integraci\u00f3n):", BLACK, True),
    ("- Registro de usuarios: RegisterUseCase + /auth/register + RegisterForm + verificaci\u00f3n email 6 d\u00edgitos", BLUE, False),
    ("- Inicio de sesi\u00f3n: LoginUseCase + /auth/login + LoginForm + JWT + refresh tokens + OAuth Google/Microsoft", BLUE, False),
    ("- Roles y autorizaci\u00f3n: RolesGuard + 3 roles (STUDENT/TEACHER/ADMIN) + decorador @Roles", BLUE, False),
    ("- CRUD evaluaciones: QuizController + QuizService + QuizForm (crear/editar/eliminar/publicar)", BLUE, False),
    ("- Generaci\u00f3n IA preguntas: QwenProvider + MistralProvider fallback + /ai/generate-questions", BLUE, False),
    ("- Ciclo sesi\u00f3n evaluaci\u00f3n: StartSession + SubmitAnswer + EndSession con timer", BLUE, False),
    ("- Calificaci\u00f3n autom\u00e1tica: FastAPI + 3 modelos (ExactMatch, Similarity, NLP) + Strategy pattern", BLUE, False),
    ("- Retroalimentaci\u00f3n IA personalizada: FeedbackPanel + WeaknessChart + AssistantChat", BLUE, False),
    ("- Historial puntajes estudiante: GET /score/history", BLUE, False),
    ("- Resultados para docente: GET /score/history/:userId", BLUE, False),
    ("- Leaderboard global: GET /score/leaderboard con Redis TTL 60s", BLUE, False),
    ("- Asistente IA tutor: POST /ai/chat + AssistantChat frontend", BLUE, False),
    ("- Administraci\u00f3n usuarios (HU14): CRUD /users + UserAdminPage (activar/desactivar/roles)", BLUE, False),
    ("- Perfil p\u00fablico: GET /profile/[username] + ProfilePage con estad\u00edsticas", BLUE, False),
    ("- Edici\u00f3n de perfil: PATCH /profile/me + EditProfilePage (avatar, bio, social)", BLUE, False),
    ("- Persistencia feedback_ia: SaveFeedbackUseCase integrado en SubmitAnswerFlow", BLUE, False),
    ("- Rate limiting: ThrottlerModule en gateway (10 req/s, 5 req/min auth)", BLUE, False),
    ("", None, False),
    ("2. Funcionalidades documentadas pero NO implementadas (o parciales):", BLACK, True),
    ("- Logros desbloqueables (HU13): backend parcial (4/7 reglas), sin API REST, sin frontend, sin integraci\u00f3n", RED, False),
    ("- Notificaciones en tiempo real: entidad existe, implementaci\u00f3n vac\u00eda (use-cases, controller, gateway vac\u00edos)", RED, False),
    ("- Eliminaci\u00f3n de cuenta: DELETE /profile/me en backend, sin frontend", RED, False),
    ("- Pruebas integraci\u00f3n frontend (Tabla 21): 6 de 7 archivos vac\u00edos", RED, False),
    ("- Pruebas funcionales frontend (Tabla 22): session-expiry.spec.ts vac\u00edo", RED, False),
    ("- Pruebas de rendimiento/carga: planificadas pero no ejecutadas", RED, False),
    ("", None, False),
    ("3. Funcionalidades implementadas NO documentadas en el documento original:", BLACK, True),
    ("- Rate limiting global (ThrottlerModule)", BLUE, False),
    ("- Cach\u00e9 de leaderboard (CacheModule + Redis TTL 60s)", BLUE, False),
    ("- Perfil p\u00fablico (GET /profile/[username])", BLUE, False),
    ("- Edici\u00f3n de perfil (PATCH /profile/me)", BLUE, False),
    ("- Administraci\u00f3n usuarios (HU14) - CRUD /users", BLUE, False),
    ("- Persistencia feedback_ia (SaveFeedbackUseCase)", BLUE, False),
    ("- Prueba SSE notifications (3 casos implementados)", BLUE, False),
    ("", None, False),
    ("4. Hallazgos principales:", BLACK, True),
    ("1) 7 suites integraci\u00f3n frontend (Tabla 21): 6 archivos vac\u00edos (AuthFlow, QuizPage, QuizPlay, FeedbackPanel, AssistantChat, Leaderboard). Solo UserAdminSection.test.tsx tiene pruebas.", RED, False),
    ("2) Logros desbloqueables (HU13): backend parcial sin API ni UI. No debieran documentarse como funcionalidad completa.", RED, False),
    ("3) Notificaciones tiempo real: m\u00f3dulo con entidad pero sin implementaci\u00f3n funcional.", RED, False),
    ("4) Eliminaci\u00f3n de cuenta: endpoint backend sin interfaz de usuario.", RED, False),
    ("5) Perfil p\u00fablico, edici\u00f3n de perfil, admin usuarios, rate limiting y persistencia feedback_ia no est\u00e1n documentados en el cuerpo del documento.", BLUE, False),
]

lp = doc.paragraphs[-1]
for text, color, bold in audit:
    if text:
        p = add_para_after(lp, text, color, bold=bold)
        lp = p
    else:
        p = add_para_after(lp, '')
        lp = p

log.append("SECCION: Resultados de la Auditor\u00eda agregada al final")

# ================================================================
# SAVE
# ================================================================
doc.save(SRC)
print(f"Respaldo: {BACKUP}")
print(f"Guardado: {SRC}")
print(f"\nCambios ({len(log)}):")
for l in log:
    print(f"  {l}")
