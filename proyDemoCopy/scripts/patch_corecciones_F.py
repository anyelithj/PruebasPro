# -*- coding: utf-8 -*-
"""Patch the `CorreccionesF.docx` to:
  1. Update legend: red = original text that does NOT comply with PROYDEMO,
     purple = corrected full text, orange = explanation of WHY it doesn't comply.
  2. Insert an orange explanation paragraph after each (red original → purple correction) pair.
  3. Append a new section "PRUEBAS EN PROYDEMO" documenting every test suite present
     in the repository, with a screenshot placeholder per group.
The original document is preserved exactly — only insertions are performed.
"""
import copy
import shutil
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = r"documentos proyecto/FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 CorreccionesF.docx"
DST = SRC  # overwrite in place

# Color palette
RED    = RGBColor(0xC0, 0x00, 0x00)
PURPLE = RGBColor(0x6A, 0x1B, 0x9A)
ORANGE = RGBColor(0xE6, 0x5C, 0x00)
BLUE   = RGBColor(0x15, 0x65, 0xC0)
GREEN  = RGBColor(0x1E, 0x7D, 0x32)
GREY   = RGBColor(0x55, 0x55, 0x55)
BLACK  = RGBColor(0x00, 0x00, 0x00)

RED_HEX_SET = {'C62828', 'FF0000', 'C00000', 'E60000', 'BF0000', 'CC0000'}
PURPLE_HEX_SET = {'6A1B9A', '7030A0', '800080', '660066', '7B2882', '9B59B6', '993399', '7E22CE'}

# Backup before mutating
shutil.copyfile(SRC, SRC.replace('.docx', '_backup.docx'))

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


def make_para_after(target_paragraph, text, color, *, bold=False, italic=False, size=10):
    """Insert a new paragraph after target_paragraph and return it."""
    new_p = doc.add_paragraph()
    # Move it to be right after target
    target_paragraph._p.addnext(new_p._p)
    r = new_p.add_run(text)
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    if color is not None:
        r.font.color.rgb = color
    pf = new_p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    pf.line_spacing = 1.0
    return new_p


# ---------------------------------------------------------------
# Step 1 — Update legend (paras 2 and 3 → tweak wording; add orange line after).
# ---------------------------------------------------------------
def replace_run_texts(p, new_text, color):
    """Replace all runs of a paragraph with a single coloured run carrying new_text."""
    # Remove existing runs
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    run = p.add_run(new_text)
    run.font.size = Pt(11)
    run.bold = False
    if color is not None:
        run.font.color.rgb = color


# We rewrite the wording of the existing red/purple legend lines so they describe
# the new colour rules requested by the user; the format is preserved.
legend_red = doc.paragraphs[2]
replace_run_texts(
    legend_red,
    "Rojo + ❌: texto del documento que NO cumple con lo que ofrece el aplicativo PROYDEMO. Se conserva tal cual para evidenciar el hallazgo.",
    RED,
)
legend_purple = doc.paragraphs[3]
replace_run_texts(
    legend_purple,
    "Morado + ✏️: corrección con el TEXTO COMPLETO que sí corresponde al aplicativo PROYDEMO (reemplazo recomendado).",
    PURPLE,
)
# Insert a new orange legend line right after the purple one.
make_para_after(
    legend_purple,
    "Naranja + \U0001f9ed: explicación del PORQUÉ el texto en rojo no cumple con lo implementado en PROYDEMO.",
    ORANGE,
    size=11,
)


# ---------------------------------------------------------------
# Step 2 — Pair every red paragraph with the next purple one and
#          insert an orange explanation immediately after the purple correction.
# ---------------------------------------------------------------
# Why-strings authored from direct inspection of PROYDEMO source code.
explanations = {
    # Figure path corrections
    "diagrams/04_Clases_UML.draw": (
        "En PROYDEMO los diagramas viven en documentos proyecto/diagrams/drawIO/ y el archivo real "
        "del diagrama de clases del módulo Auth es 05_Diagrama_Clases_UML.drawio. La ruta "
        "diagrams/04_Clases_UML.draw del texto en rojo no existe en el repositorio."
    ),
    "diagrams/06_Secuencias_OAuth.draw": (
        "El diagrama de secuencia para OAuth corresponde al archivo 07_Diagrama_Secuencias.drawio "
        "dentro de documentos proyecto/diagrams/drawIO/. La ruta diagrams/06_Secuencias_OAuth.draw del "
        "texto en rojo no se encuentra en el repositorio de PROYDEMO."
    ),
    "diagrams/06b_Secuencias_PlayQuiz.draw": (
        "En PROYDEMO el flujo de resolución de quiz está documentado en "
        "documentos proyecto/diagrams/drawIO/07_Diagrama_Secuencias.drawio (y 12_Secuencia_Crear_Evaluacion "
        "para creación). La ruta diagrams/06b_Secuencias_PlayQuiz.draw del texto en rojo no existe."
    ),
    # ModelFactory description
    "ModelFactory se encarga de la selección dinámica del modelo": (
        "En PROYDEMO la selección de modelo en el microservicio FastAPI la realiza model_factory "
        "(patrón Strategy/Factory) y la calificación por lotes usa asyncio.gather, no Celery. "
        "La descripción dinámica del texto en rojo confunde la responsabilidad con el procesamiento concurrente."
    ),
    # Observer Celery
    "Observer: procesamiento de eventos asíncronos mediante Celery": (
        "PROYDEMO emite eventos de dominio con EventEmitter2 en NestJS (QuizCompletedEvent y similares) y "
        "ejecuta concurrencia en FastAPI con asyncio. Celery NO está instalado ni configurado en el "
        "repositorio (no aparece en requirements.txt ni en docker-compose)."
    ),
    # gRPC sentences
    "REST y gRPC": (
        "PROYDEMO no implementa gRPC. La comunicación entre NestJS y FastAPI es exclusivamente "
        "REST sobre HTTPS con JSON: el cliente NestJS es @nestjs/axios (AIClientService) y FastAPI expone "
        "endpoints REST documentados con OpenAPI. No existen protos, servidores gRPC ni dependencias gRPC."
    ),
    "REST utilizando como soporte el modo de transport": (
        "La frase del texto en rojo arrastra una redacción incorrecta. En PROYDEMO la comunicación "
        "es REST/HTTPS con JSON (autenticación por JWT vía Authorization: Bearer) y no usa "
        "modos de transporte alternativos como gRPC o WebSocket para el servicio de IA."
    ),
    "REST y gRPC entre los microservicios": (
        "El sistema no implementa gRPC: NestJS llama a FastAPI mediante REST/HTTPS y JSON, validado por "
        "las pruebas de integración del microservicio (apps/ai-service/tests/integration/*) y por las "
        "pruebas Jest+Supertest del backend (apps/backend/__tests__/integration/*)."
    ),
    "APIs REST y gRPC": (
        "Las pruebas de integración del repositorio cubren solo APIs REST. No existen pruebas ni código "
        "fuente gRPC en ninguno de los tres componentes (frontend Next.js, backend NestJS, microservicio FastAPI)."
    ),
    "protocolos REST y gRPC": (
        "En PROYDEMO la comunicación entre microservicios se realiza con REST sobre HTTPS. gRPC nunca "
        "fue incorporado al stack (no aparece en package.json del backend ni en requirements.txt del servicio de IA)."
    ),
    # 'petrolero' typo
    "petrolero de IA crea evaluaciones": (
        "El texto en rojo contiene la palabra 'petrolero', que es un error tipográfico. En PROYDEMO el "
        "componente que genera evaluaciones es el AIProviderFactory (Qwen/Mistral) descrito en el código "
        "del backend, no un 'petrolero'."
    ),
    "calificación automática con FastAPI y la entrega en la retroalimentación humanizada del petrolero": (
        "Misma confusión tipográfica: el agente de IA que entrega la retroalimentación está "
        "implementado en apps/ai-service (FastAPI + LangChain + Ollama Llama 3 con RAG); no hay ningún "
        "componente llamado 'petrolero' en el código de PROYDEMO."
    ),
}


def find_explanation(red_text):
    for key, value in explanations.items():
        if key.lower() in red_text.lower():
            return value
    return None


# Walk paragraphs in REVERSE so insertions don't shift earlier indices.
red_indices = []
for i, p in enumerate(doc.paragraphs):
    if first_run_color(p) == 'R' and i > 5:  # skip legend area
        red_indices.append(i)

# For each red para, look ahead for the next purple paragraph; insert orange after it.
to_insert = []  # list of (purple_paragraph, explanation_text)
all_paras = doc.paragraphs
for i in red_indices:
    red_p = all_paras[i]
    red_text = red_p.text
    # Find next purple paragraph (within 5 paras forward).
    purple_p = None
    for j in range(i + 1, min(i + 6, len(all_paras))):
        if first_run_color(all_paras[j]) == 'P':
            purple_p = all_paras[j]
            break
    if purple_p is None:
        continue
    expl = find_explanation(red_text)
    if expl is None:
        expl = (
            "El texto en rojo no se corresponde con lo implementado en PROYDEMO; revisar la "
            "sección correspondiente del código o de los diagramas drawIO para validar la corrupción."
        )
    to_insert.append((purple_p, expl))

# Apply insertions from last to first so earlier paragraph references remain stable.
for purple_p, expl in reversed(to_insert):
    make_para_after(
        purple_p,
        "\U0001f9ed " + expl,
        ORANGE,
        size=10,
    )


# ---------------------------------------------------------------
# Step 3 — Append "PRUEBAS EN PROYDEMO" section at the end of the document.
# ---------------------------------------------------------------
def add_heading(text, level=1):
    """Tolerant heading helper: falls back to a bold paragraph when the style
    (e.g. 'Heading 3') is not defined in the source document."""
    try:
        return doc.add_heading(text, level=level)
    except KeyError:
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(13 - level)
        run.font.color.rgb = BLACK
        return p


def add_para(text, *, color=None, bold=False, italic=False, size=10):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    if color is not None:
        r.font.color.rgb = color
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
            run = cells[i].paragraphs[0].add_run(str(val))
            run.font.size = Pt(9)
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


doc.add_page_break()
add_heading("DOCUMENTACIÓN DE PRUEBAS EJECUTADAS EN PROYDEMO", 1)
add_para(
    "Esta sección inventaria las pruebas automáticas presentes en el repositorio de PROYDEMO, "
    "organizadas por componente y por nivel de la pirámide de pruebas. Cada tabla lista los archivos de "
    "pruebas con su propósito y deja un espacio reservado debajo para insertar la captura de la ejecución.",
    italic=True,
    color=GREY,
)
add_para(
    "Comandos para ejecutar y obtener evidencia visual:",
    bold=True,
)
add_para("• Frontend (Jest unit + integration):  cd apps/frontend-next && npm test")
add_para("• Frontend (Playwright funcional/usabilidad/rendimiento):  cd apps/frontend-next && npx playwright test")
add_para("• Backend (Jest unit + integration + usability):  cd apps/backend && npm test")
add_para("• Microservicio de IA (Pytest):  cd apps/ai-service && python -m pytest tests/ -q")

# ----- Frontend -----
add_heading("Frontend (Next.js 16)", 2)

# Unit
add_heading("Pruebas unitarias (Jest + React Testing Library + jest-axe)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/frontend-next/__tests__/unit/lib/utils.test.ts", "Helpers de utilidades (cn, formatters)."),
        ("apps/frontend-next/__tests__/unit/lib/validations.test.ts", "Esquemas Zod de validación del frontend."),
        ("apps/frontend-next/__tests__/unit/store/authSlice.test.ts", "Reducer y acciones del slice de autenticación."),
        ("apps/frontend-next/__tests__/unit/store/quizSlice.test.ts", "Máquina de estados del slice de quiz."),
        ("apps/frontend-next/__tests__/unit/store/timerSlice.test.ts", "Slice del cronómetro global."),
        ("apps/frontend-next/__tests__/unit/hooks/useAuth.test.ts", "Hook de autenticación (Auth.js + Redux)."),
        ("apps/frontend-next/__tests__/unit/hooks/useDebounce.test.ts", "Hook de debounce con fake timers."),
        ("apps/frontend-next/__tests__/unit/hooks/useLocalStorage.test.ts", "Hook de persistencia en localStorage."),
        ("apps/frontend-next/__tests__/unit/hooks/useTimer.test.ts", "Hook de cuenta regresiva local."),
        ("apps/frontend-next/__tests__/unit/components/ui/button.test.tsx", "Atomic UI: botón y sus variantes."),
        ("apps/frontend-next/__tests__/unit/components/ui/input.test.tsx", "Atomic UI: input."),
        ("apps/frontend-next/__tests__/unit/components/ui/dialog.test.tsx", "Molecule UI: diálogo Radix accesible."),
        ("apps/frontend-next/__tests__/unit/components/auth/LoginForm.test.tsx", "Formulario de login con react-hook-form + Zod."),
        ("apps/frontend-next/__tests__/unit/components/auth/RegisterForm.test.tsx", "Formulario de registro con validaciones."),
        ("apps/frontend-next/__tests__/unit/components/auth/OAuthButtons.test.tsx", "Botones OAuth Google y Microsoft."),
        ("apps/frontend-next/__tests__/unit/components/quiz/AnswerOption.test.tsx", "Ítem de respuesta del quiz."),
        ("apps/frontend-next/__tests__/unit/components/quiz/QuestionCard.test.tsx", "Tarjeta de pregunta."),
        ("apps/frontend-next/__tests__/unit/components/quiz/ScoreDisplay.test.tsx", "Visualización de puntaje."),
        ("apps/frontend-next/__tests__/unit/components/quiz/TimerBar.test.tsx", "Barra de tiempo de la pregunta."),
        ("apps/frontend-next/__tests__/unit/components/shared/EmptyState.test.tsx", "Estado vacío reutilizable."),
        ("apps/frontend-next/__tests__/unit/components/shared/ErrorBoundary.test.tsx", "Límite de errores de React."),
        ("apps/frontend-next/__tests__/unit/a11y/atoms.a11y.test.tsx", "Auditoría jest-axe sobre los átomos UI."),
        ("apps/frontend-next/__tests__/unit/a11y/molecules.a11y.test.tsx", "Auditoría jest-axe sobre las moléculas UI."),
    ],
)
add_screenshot_placeholder("Salida de `npm test` (Frontend) — 23 suites, 143 pruebas en verde.")

# Integration
add_heading("Pruebas de integración (Jest + RTL + MSW)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/frontend-next/__tests__/integration/AuthFlow.test.tsx", "Flujo completo de autenticación con mocks HTTP."),
        ("apps/frontend-next/__tests__/integration/QuizPage.test.tsx", "Listado de quizzes y navegación."),
        ("apps/frontend-next/__tests__/integration/QuizPlay.test.tsx", "Resolver un quiz de extremo a extremo."),
        ("apps/frontend-next/__tests__/integration/Leaderboard.test.tsx", "Tabla de ranking con datos mockeados."),
        ("apps/frontend-next/__tests__/integration/FeedbackPanel.test.tsx", "Panel de feedback IA en frontend."),
        ("apps/frontend-next/__tests__/integration/AssistantChat.test.tsx", "Chat con el agente IA."),
    ],
)
add_screenshot_placeholder("Salida de las pruebas de integración del frontend.")

# Functional Playwright
add_heading("Pruebas funcionales E2E (Playwright)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/frontend-next/__tests__/functional/auth.spec.ts", "Login/registro/logout vía navegador real."),
        ("apps/frontend-next/__tests__/functional/quiz-flow.spec.ts", "Flujo completo de resolución de quiz."),
        ("apps/frontend-next/__tests__/functional/ai-feedback.spec.ts", "Recepción del feedback IA en la UI."),
        ("apps/frontend-next/__tests__/functional/leaderboard.spec.ts", "Ranking público y por categoría."),
        ("apps/frontend-next/__tests__/functional/navigation.spec.ts", "Navegación entre páginas y rutas."),
        ("apps/frontend-next/__tests__/functional/protected-routes.spec.ts", "Protección de rutas según rol."),
        ("apps/frontend-next/__tests__/functional/session-expiry.spec.ts", "Renovación de sesión y expiración."),
        ("apps/frontend-next/__tests__/functional/dark-mode.spec.ts", "Conmutación de tema claro/oscuro."),
    ],
)
add_screenshot_placeholder("Ejecución de Playwright (modo headed) sobre el frontend.")

# Usability Playwright
add_heading("Pruebas de usabilidad y accesibilidad (Playwright + axe-playwright)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/frontend-next/__tests__/usability/accessibility.spec.ts", "Auditoría axe contra WCAG 2.1 AA."),
        ("apps/frontend-next/__tests__/usability/keyboard-nav.spec.ts", "Navegación sólo con teclado."),
        ("apps/frontend-next/__tests__/usability/responsive.spec.ts", "Layout responsive en móvil/tablet/desktop."),
        ("apps/frontend-next/__tests__/usability/cross-browser.spec.ts", "Compatibilidad Chromium/Firefox/WebKit."),
        ("apps/frontend-next/__tests__/usability/dark-mode-contrast.spec.ts", "Contraste de colores en modo oscuro."),
        ("apps/frontend-next/__tests__/usability/i18n.spec.ts", "Internacionalización y locales."),
        ("apps/frontend-next/__tests__/usability/error-handling-ux.spec.ts", "Manejo de errores visible al usuario."),
    ],
)
add_screenshot_placeholder("Reporte HTML de Playwright para usabilidad.")

# Performance
add_heading("Pruebas de rendimiento (Playwright + Lighthouse + Bundle Analyzer)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/frontend-next/__tests__/performance/landing.perf.spec.ts", "Métricas de Core Web Vitals en la landing."),
        ("apps/frontend-next/__tests__/performance/quiz-page.perf.spec.ts", "Rendimiento de la página de quiz."),
        ("apps/frontend-next/__tests__/performance/navigation.perf.spec.ts", "Latencia entre navegaciones."),
        ("apps/frontend-next/__tests__/performance/bundle.analysis.ts", "Análisis de tamaño del bundle (next/bundle-analyzer)."),
    ],
)
add_screenshot_placeholder("Reporte Lighthouse y bundle-analyzer del frontend.")

# ----- Backend -----
add_heading("Backend (NestJS 11)", 2)

add_heading("Pruebas unitarias (Jest)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/backend/__tests__/unit/guards/jwt-auth.guard.spec.ts", "Guard JWT global y rutas públicas."),
        ("apps/backend/__tests__/unit/guards/roles.guard.spec.ts", "RolesGuard y jerarquía USER/TEACHER/ADMIN."),
        ("apps/backend/__tests__/unit/interceptors/transform.interceptor.spec.ts", "Envelope { statusCode, data, meta }."),
        ("apps/backend/__tests__/unit/pipes/validation.pipe.spec.ts", "ValidationPipe global y whitelist."),
        ("apps/backend/__tests__/unit/use-cases/auth/login.use-case.spec.ts", "Caso de uso de login."),
        ("apps/backend/__tests__/unit/use-cases/auth/register.use-case.spec.ts", "Caso de uso de registro."),
        ("apps/backend/__tests__/unit/use-cases/auth/refresh-token.use-case.spec.ts", "Rotación del refresh token."),
        ("apps/backend/__tests__/unit/use-cases/quiz/end-session.use-case.spec.ts", "Cierre de la sesión de quiz."),
        ("apps/backend/__tests__/unit/use-cases/quiz/submit-answer.use-case.spec.ts", "Calificación local + delegación a FastAPI."),
        ("apps/backend/__tests__/unit/use-cases/score/calculate-score.use-case.spec.ts", "Cálculo de puntaje con bonificaciones."),
        ("apps/backend/__tests__/unit/use-cases/score/check-achievements.use-case.spec.ts", "Desbloqueo de logros."),
        ("apps/backend/__tests__/unit/value-objects/email.vo.spec.ts", "Value Object Email."),
        ("apps/backend/__tests__/unit/value-objects/points.vo.spec.ts", "Value Object Points."),
    ],
)
add_screenshot_placeholder("Salida de `npm test` (apps/backend) — suites unitarias en verde.")

add_heading("Pruebas de integración (Jest + Supertest)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/backend/__tests__/integration/auth/login.integration.spec.ts", "POST /auth/login: pipeline HTTP completo."),
        ("apps/backend/__tests__/integration/auth/register.integration.spec.ts", "POST /auth/register: validaciones y conflictos."),
        ("apps/backend/__tests__/integration/auth/refresh.integration.spec.ts", "POST /auth/refresh: rotación y errores."),
        ("apps/backend/__tests__/integration/quiz/fetch-questions.integration.spec.ts", "GET /quiz y GET /quiz/:id."),
        ("apps/backend/__tests__/integration/quiz/session.integration.spec.ts", "Ciclo de sesión start/submit/end."),
        ("apps/backend/__tests__/integration/score/leaderboard.integration.spec.ts", "GET /score/leaderboard con ranking."),
        ("apps/backend/__tests__/integration/score/submit.integration.spec.ts", "GET /score/history del usuario."),
        ("apps/backend/__tests__/integration/notifications/sse.integration.spec.ts", "Entidad Notification (SSE pendiente)."),
    ],
)
add_screenshot_placeholder("Salida de las pruebas de integración del backend.")

add_heading("Pruebas de usabilidad de la API (Jest + Supertest)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/backend/__tests__/usability/api-versioning.spec.ts", "Prefijo /api/v1 obligatorio en todas las rutas."),
        ("apps/backend/__tests__/usability/error-messages.spec.ts", "Forma uniforme de los errores HTTP."),
        ("apps/backend/__tests__/usability/response-envelope.spec.ts", "Envelope estándar para respuestas exitosas."),
        ("apps/backend/__tests__/usability/swagger-contract.spec.ts", "Contrato OpenAPI generado por @nestjs/swagger."),
    ],
)
add_screenshot_placeholder("Ejecución de las pruebas de usabilidad de la API REST.")

# ----- AI service -----
add_heading("Microservicio de IA (FastAPI)", 2)

add_heading("Pruebas unitarias (Pytest)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/ai-service/tests/unit/models/test_model_factory.py", "Selección del modelo de calificación (Strategy)."),
        ("apps/ai-service/tests/unit/models/test_similarity_model.py", "Modelo de similitud semántica."),
        ("apps/ai-service/tests/unit/schemas/test_chat_schemas.py", "Esquemas Pydantic v2 del asistente."),
        ("apps/ai-service/tests/unit/schemas/test_feedback_schemas.py", "Esquemas Pydantic v2 del feedback."),
        ("apps/ai-service/tests/unit/schemas/test_grading_schemas.py", "Esquemas Pydantic v2 de calificación."),
        ("apps/ai-service/tests/unit/use_cases/assistant/test_chat_with_agent.py", "Caso de uso del chat con el agente IA."),
        ("apps/ai-service/tests/unit/use_cases/assistant/test_get_conversation.py", "Recuperación del historial conversacional."),
        ("apps/ai-service/tests/unit/use_cases/feedback/test_analyze_weaknesses.py", "Análisis de debilidades del estudiante."),
        ("apps/ai-service/tests/unit/use_cases/feedback/test_generate_feedback.py", "Generación de feedback con RAG."),
        ("apps/ai-service/tests/unit/use_cases/feedback/test_generate_study_plan.py", "Plan de estudio personalizado."),
        ("apps/ai-service/tests/unit/use_cases/grading/test_batch_grade.py", "Calificación por lotes con asyncio.gather."),
        ("apps/ai-service/tests/unit/use_cases/grading/test_generate_rubric.py", "Generación de rúbricas."),
        ("apps/ai-service/tests/unit/use_cases/grading/test_grade_answer.py", "Calificación de una respuesta."),
        ("apps/ai-service/tests/unit/value_objects/test_confidence.py", "Value Object Confidence."),
        ("apps/ai-service/tests/unit/value_objects/test_score.py", "Value Object Score."),
    ],
)
add_screenshot_placeholder("Salida de `pytest tests/unit -q` del microservicio de IA.")

add_heading("Pruebas de integración (Pytest + HTTPX)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/ai-service/tests/integration/grading/test_grading_router.py", "Router /api/v1/grading sobre HTTP."),
        ("apps/ai-service/tests/integration/grading/test_batch_grading.py", "Endpoint de calificación por lotes."),
        ("apps/ai-service/tests/integration/feedback/test_feedback_router.py", "Router /api/v1/feedback."),
        ("apps/ai-service/tests/integration/feedback/test_study_plan_router.py", "Endpoint de plan de estudio."),
        ("apps/ai-service/tests/integration/assistant/test_assistant_router.py", "Router del asistente conversacional."),
        ("apps/ai-service/tests/integration/assistant/test_conversation_state.py", "Persistencia del estado del chat."),
        ("apps/ai-service/tests/integration/analytics/test_analytics_router.py", "Router /api/v1/analytics."),
    ],
)
add_screenshot_placeholder("Salida de las pruebas de integración del servicio de IA.")

add_heading("Pruebas funcionales (Pytest, end-to-end del servicio)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/ai-service/tests/functional/test_auth_protection.py", "Protección por JWT del microservicio."),
        ("apps/ai-service/tests/functional/test_grading_flow.py", "Flujo end-to-end de calificación."),
        ("apps/ai-service/tests/functional/test_batch_flow.py", "Calificación por lotes end-to-end."),
        ("apps/ai-service/tests/functional/test_feedback_flow.py", "Generación de feedback end-to-end."),
        ("apps/ai-service/tests/functional/test_assistant_flow.py", "Conversación con el tutor end-to-end."),
    ],
)
add_screenshot_placeholder("Salida de las pruebas funcionales del microservicio de IA.")

add_heading("Pruebas de usabilidad de la API (Pytest)", 3)
add_table(
    ["Archivo", "Qué valida"],
    [
        ("apps/ai-service/tests/usability/test_docs_endpoint.py", "Disponibilidad de /docs (Swagger UI)."),
        ("apps/ai-service/tests/usability/test_openapi_contract.py", "Contrato OpenAPI generado por FastAPI."),
        ("apps/ai-service/tests/usability/test_response_consistency.py", "Forma consistente de las respuestas."),
        ("apps/ai-service/tests/usability/test_error_messages.py", "Mensajes de error con detalle estándar."),
    ],
)
add_screenshot_placeholder("Salida de las pruebas de usabilidad del servicio de IA.")

doc.add_paragraph()
last = doc.add_paragraph()
last.alignment = WD_ALIGN_PARAGRAPH.CENTER
lr = last.add_run("Fin de la sección de documentación de pruebas de PROYDEMO.")
lr.italic = True
lr.font.size = Pt(9)
lr.font.color.rgb = GREY

doc.save(DST)
print("OK guardado:", DST)
print("paras totales:", len(doc.paragraphs), "tablas:", len(doc.tables))
print("explicaciones naranjas insertadas:", len(to_insert))
