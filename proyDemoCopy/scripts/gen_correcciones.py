# -*- coding: utf-8 -*-
"""Genera 'FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 Correcciones.docx'.
Copia el original (preserva todo) y agrega anexo de correcciones color-codificado,
documentacion de software/SCRUM, UML, base de datos+normalizacion, Figma y Agente IA.
"""
import shutil, copy
from docx import Document
from docx.shared import RGBColor, Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = r"documentos proyecto/FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 ent.docx"
DST = r"documentos proyecto/FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 Correcciones.docx"

GREEN  = RGBColor(0x1E, 0x7D, 0x32)
RED    = RGBColor(0xC6, 0x28, 0x28)
PURPLE = RGBColor(0x6A, 0x1B, 0x9A)
BLUE   = RGBColor(0x15, 0x65, 0xC0)
GREY   = RGBColor(0x55, 0x55, 0x55)
BLACK  = RGBColor(0x00, 0x00, 0x00)

shutil.copyfile(SRC, DST)
doc = Document(DST)

import re as _re
# Abreviaturas a expandir (sensible a mayúsculas, frontera de palabra).
ABBR = [
 ("RNF","Requerimiento No Funcional"),("RF","Requerimiento Funcional"),
 ("UML","Lenguaje Unificado de Modelado"),("DER","Diagrama Entidad Relación"),
 ("DDD","Diseño Guiado por el Dominio"),("RAG","Generación Aumentada por Recuperación"),
 ("ACL","Capa Anticorrupción"),("BFF","Backend para Frontend"),
 ("HTTPS","Protocolo Seguro de Transferencia de Hipertexto"),
 ("HTTP","Protocolo de Transferencia de Hipertexto"),
 ("REST","Transferencia de Estado Representacional"),
 ("API","Interfaz de Programación de Aplicaciones"),
 ("JWT","Token Web de autenticación"),("OAuth","autorización delegada"),
 ("OIDC","OpenID Connect"),("SSE","Eventos Enviados por el Servidor"),
 ("WS","WebSocket"),("LLM","modelo grande de lenguaje"),
 ("NLP","procesamiento de lenguaje natural"),("DoD","Definición de Terminado"),
 ("TTL","tiempo de vida"),("RBAC","control de acceso basado en roles"),
 ("CRUD","crear, leer, actualizar y eliminar"),("E2E","de extremo a extremo"),
 ("RTL","React Testing Library"),("TLS","seguridad de la capa de transporte"),
 ("PK","clave primaria"),("FK","clave foránea"),("UK","clave única"),
 ("UI","interfaz de usuario"),("UX","experiencia de usuario"),
 ("BD","base de datos"),("ER","Entidad Relación"),("IA","inteligencia artificial"),
 ("ID","Identificador"),("min","minutos"),
]
_SYM = [("◆──"," contiene "),("◆—"," contiene "),("→"," a "),("⇒"," a "),
 ("≥","mayor o igual a "),("≤","menor o igual a "),("≈","aproximadamente "),
 ("—",", "),("–"," a "),("·",", "),("•",""),("％"," por ciento"),("%"," por ciento")]

def sanitize(s):
    """Texto plano: sin / + @ - _ *, sin abreviaturas. Solo para el anexo."""
    if not isinstance(s, str) or not s:
        return s
    s = s.replace("NeuroEdu IA", "NeuroEdu")  # nombre propio: no expandir
    for a,b in _SYM: s = s.replace(a,b)
    # Separar caracteres especiales ANTES de expandir siglas (para captar tokens pegados con _ o -)
    s = s.replace("/"," ").replace("+"," y ").replace("@","").replace("*","")
    s = s.replace("_"," ").replace("-"," ")
    for a,b in ABBR: s = _re.sub(r'\b'+_re.escape(a)+r'\b', b, s)
    s = _re.sub(r'\s+([,.:;])', r'\1', s)
    s = _re.sub(r'\s{2,}', ' ', s)  # sin strip: preserva el espacio entre runs concatenados
    return s

def compact(p):
    pf = p.paragraph_format
    pf.space_before = Pt(0); pf.space_after = Pt(2); pf.line_spacing = 1.0
    pf.left_indent = Pt(0); pf.first_line_indent = Pt(0)
    return p

def para(text="", color=None, bold=False, italic=False, size=11, align=None):
    p = doc.add_paragraph(); compact(p)
    if align: p.alignment = align
    r = p.add_run(sanitize(text))
    r.font.size = Pt(size); r.bold = bold; r.italic = italic
    if color is not None: r.font.color.rgb = color
    return p

def multi(parts, size=11):
    """parts = list of (text,color,bold). Single paragraph, multiple runs."""
    p = doc.add_paragraph(); compact(p)
    for text, color, bold in parts:
        r = p.add_run(sanitize(text)); r.font.size = Pt(size); r.bold = bold
        if color is not None: r.font.color.rgb = color
    return p

def h(text, level=1):
    p = doc.add_heading(sanitize(text), level=level); compact(p)
    return p

def field(p, instr, placeholder="(El índice se genera automáticamente al abrir el documento en Word)"):
    r = p.add_run()
    fb = OxmlElement('w:fldChar'); fb.set(qn('w:fldCharType'), 'begin'); r._r.append(fb)
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = instr; r._r.append(it)
    fs = OxmlElement('w:fldChar'); fs.set(qn('w:fldCharType'), 'separate'); r._r.append(fs)
    r2 = p.add_run(placeholder)
    fe = OxmlElement('w:fldChar'); fe.set(qn('w:fldCharType'), 'end'); r2._r.append(fe)

FIG_N = [0]; TAB_N = [0]
def caption(label, text):
    """label 'Figura' o 'Tabla'. Inserta caption con SEQ para indices automaticos."""
    p = doc.add_paragraph(); compact(p)
    try: p.style = doc.styles['Caption']
    except KeyError: pass
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f"{label} ").italic = True
    r = p.add_run()
    fb = OxmlElement('w:fldChar'); fb.set(qn('w:fldCharType'), 'begin'); r._r.append(fb)
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = f' SEQ {label} \\* ARABIC '; r._r.append(it)
    fs = OxmlElement('w:fldChar'); fs.set(qn('w:fldCharType'), 'separate'); r._r.append(fs)
    r._r.append(OxmlElement('w:t'))
    fe = OxmlElement('w:fldChar'); fe.set(qn('w:fldCharType'), 'end'); r._r.append(fe)
    p.add_run(". " + sanitize(text)).italic = True
    return p

def table(headers, rows, header_color=BLUE):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = 'Table Grid'
    for i, hd in enumerate(headers):
        c = t.rows[0].cells[i]; c.paragraphs[0].clear()
        rr = c.paragraphs[0].add_run(sanitize(hd)); rr.bold = True; rr.font.size = Pt(9)
        rr.font.color.rgb = header_color; compact(c.paragraphs[0])
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            txt = val; col = None
            if isinstance(val, tuple): txt, col = val
            cells[i].paragraphs[0].clear()
            rr = cells[i].paragraphs[0].add_run(sanitize(str(txt))); rr.font.size = Pt(9)
            if col is not None: rr.font.color.rgb = col
            compact(cells[i].paragraphs[0])
    return t

def legend(): para()

# ===== Salto de pagina + portada del anexo =====
doc.add_page_break()
p = para("ANEXO DE CORRECCIONES Y ACTUALIZACIÓN TÉCNICA", color=BLACK, bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER)
para("Aplicativo PROYDEMO / NeuroEdu IA — Alineación del documento con el código realmente implementado",
     color=GREY, italic=True, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
para()
para("LEYENDA DE MARCAS DE REVISIÓN", bold=True, size=12)
multi([("✅  Verde: ", GREEN, True), ("información correcta y verificada contra el código.", GREEN, False)])
multi([("❌  Rojo: ", RED, True), ("información que no aplica a PROYDEMO (no se elimina; se explica el porqué).", RED, False)])
multi([("Morado: ", PURPLE, True), ("corrección de texto, con formato ANTES / CORREGIDO.", PURPLE, False)])
multi([("🆕  Azul: ", BLUE, True), ("información nueva agregada.", BLUE, False)])
para("Nota: el contenido original del documento se conserva íntegro en las páginas anteriores. "
     "Este anexo revisa sección por sección y marca cada cambio.", color=GREY, italic=True, size=10)

# ===== INDICES AUTOMATICOS =====
doc.add_page_break()
h("ÍNDICES AUTOMÁTICOS", 1)
para("Coloque el cursor en cada índice y presione F9 (o Clic derecho → Actualizar campos) para poblarlos.",
     color=GREY, italic=True, size=10)
para("ÍNDICE GENERAL", bold=True, size=12)
field(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u'); compact(doc.paragraphs[-1])
para("ÍNDICE DE TABLAS", bold=True, size=12)
field(doc.add_paragraph(), 'TOC \\h \\z \\c "Tabla"'); compact(doc.paragraphs[-1])
para("ÍNDICE DE FIGURAS", bold=True, size=12)
field(doc.add_paragraph(), 'TOC \\h \\z \\c "Figura"'); compact(doc.paragraphs[-1])

def antes_corr(antes, corr):
    multi([("ANTES: ", PURPLE, True), (antes, GREY, False)])
    multi([("CORREGIDO: ", PURPLE, True), (corr, PURPLE, False)])

def ok(txt):  multi([("✅ ", GREEN, True), (txt, GREEN, False)])
def no(txt):  multi([("❌ ", RED, True), (txt, RED, False)])
def nw(txt):  multi([("🆕 ", BLUE, True), (txt, BLUE, False)])

# ============================================================
# 1. REVISION SECCION POR SECCION
# ============================================================
doc.add_page_break()
h("1. REVISIÓN Y ACTUALIZACIÓN SECCIÓN POR SECCIÓN", 1)

def blue(label, body):
    multi([("🆕 " + label + " ", BLUE, True), (body, BLUE, False)], size=10)

# --- 1.1 RESUMEN (sección independiente — formato abstract ≤300 palabras) ---
h("1.1 Resumen", 2)
para("Estructura del resumen: propósito del trabajo, método planteado para abordar el problema y principales resultados, hallazgos y conclusiones (extensión máxima 300 palabras). Versión corregida y alineada al aplicativo:", color=GREY, italic=True, size=10)
para("El presente trabajo documenta el diseño e implementación del módulo de evaluaciones inteligentes de PROYDEMO (NeuroEdu IA), una plataforma neuroeducativa con un agente de asistencia basado en inteligencia artificial. El propósito es transformar la evaluación tradicional —estática y de retroalimentación tardía— en un proceso formativo que califique automáticamente y entregue retroalimentación pedagógica personalizada. Para abordar el problema se adoptó una arquitectura de microservicios: un backend NestJS con arquitectura hexagonal y Clean Architecture (siete módulos) que expone una API REST consumida por un frontend Next.js, y un microservicio de IA en FastAPI que aplica el patrón RAG (LangChain + FAISS + Ollama Llama 3) para calificar respuestas abiertas y generar retroalimentación. Las preguntas cerradas se califican localmente por coincidencia exacta y las abiertas mediante similitud semántica, con un mecanismo de resiliencia (fallback local) ante fallos del servicio de IA. La persistencia se realiza en PostgreSQL (once tablas) y Redis se utiliza como caché. El acceso combina autenticación JWT con OAuth 2.0 (Google y Microsoft) y control de acceso por roles. Como método de desarrollo se empleó Scrum en sprints de dos semanas. Los principales resultados son: un módulo funcional de creación, resolución y calificación de evaluaciones; generación automática de preguntas mediante proveedores LLM con caché; cálculo de puntajes con bonificaciones y un ranking; y una batería de pruebas automatizadas (Jest, Pytest y Playwright) sobre los tres componentes. Se concluye que la separación dominio/infraestructura y la externalización de la IA permitieron iterar la calificación y el feedback sin afectar el backend transaccional, entregando una base robusta y escalable; quedan como trabajo futuro la persistencia histórica del feedback y las notificaciones en tiempo real.", size=10)
no("Comunicación gRPC: no aplica. La integración NestJS↔FastAPI es exclusivamente REST/HTTP.")

# --- 1.2 INTRODUCCIÓN (sección independiente — dos párrafos) ---
h("1.2 Introducción", 2)
para("La práctica empresarial se desarrolló en el contexto de un aplicativo neuroeducativo orientado a potenciar el aprendizaje mediante inteligencia artificial. En la educación tradicional, la evaluación suele ser un instrumento estático que mide resultados pero ofrece escasa retroalimentación oportuna, lo que incrementa la carga cognitiva del estudiante y limita la mejora continua. PROYDEMO aborda esta problemática con un módulo de evaluaciones inteligentes que califica automáticamente y entrega retroalimentación pedagógica personalizada, apoyándose en un agente de inteligencia artificial.", size=10)
para("Para lograrlo se diseñó una arquitectura de microservicios desacoplada: un backend NestJS con arquitectura hexagonal y un microservicio de IA en FastAPI (RAG con LangChain, FAISS y Ollama Llama 3), consumidos por un frontend Next.js que actúa como Backend for Frontend. El presente documento describe el método, la arquitectura, el modelo de datos, los diagramas UML, el plan de pruebas y los resultados obtenidos, distinguiendo en todo momento lo efectivamente implementado de lo previsto como trabajo futuro.", size=10)

h("1.3 Planteamiento del Problema", 2)
ok("Problema válido: la evaluación tradicional es estática, genera alta carga cognitiva y entrega retroalimentación tardía.")
blue("Respuesta del sistema:",
     "feedback inmediato y personalizado por pregunta, análisis de debilidades por categoría (visualizado en WeaknessChart del frontend) e historial de desempeño paginado por usuario.")

h("1.4 Justificación", 2)
ok("Justificación pedagógica y técnica (microservicios escalables) pertinente.")
blue("Justificación arquitectónica:",
     "aislar la IA en un microservicio FastAPI permite escalar e iterar los modelos sin afectar el backend transaccional NestJS; la arquitectura hexagonal desacopla el dominio de los frameworks y de la base de datos, lo que mejora la testeabilidad y la mantenibilidad. La comunicación REST mantiene los servicios débilmente acoplados.")

h("1.5 Objetivos (General y Específicos)", 2)
ok("Objetivo general (prototipo funcional del módulo de evaluación con IA): cumplido.")
ok("OE1 — arquitectura escalable de microservicios NestJS + FastAPI: cumplido (7 módulos NestJS hexagonales + 4 módulos FastAPI).")
ok("OE2 — prototipos de interacción con el agente IA: cumplido (módulo assistant en FastAPI con tutor_agent + RAG sobre FAISS).")
ok("OE3 — documentar con modelo entidad-relación y diagramas UML: cumplido (10 diagramas drawIO actualizados).")
no("Cualquier objetivo que comprometa notificaciones push en tiempo real como entregable cerrado: el WebSocket Gateway es un stub vacío (no hay @WebSocketGateway en el código); el tiempo real no está operativo.")

h("1.6 Alcance", 2)
ok("Alcance acotado al módulo de evaluaciones y al subsistema de acceso: coincide con lo implementado.")
blue("Dentro del alcance (implementado):",
     "auth (JWT, refresh con rotación, OAuth Google/Microsoft, verify-email en modo stub, password-reset con token + log del enlace), users (perfil e historial), quiz (creación manual y por IA, sesión y calificación), score (ranking y logros) y ai (ACL hacia FastAPI).")
no("Fuera del alcance real (marcado PREVISTO en los diagramas): envío real de correos (Mailer/SMTP), notificaciones en tiempo real (WebSocket/SSE), colas Bull/Celery y persistencia histórica de feedback_ia. Las tablas notifications y feedback_ia existen pero su capa de aplicación no está implementada.")

# --- 1.7 REVISIÓN DE LITERATURA / ANTECEDENTES ---
h("1.7 Revisión de Literatura / Antecedentes", 2)
ok("Los antecedentes del documento (neuroeducación, transición hacia agentes de IA autónomos y plataformas EdTech) son pertinentes y están respaldados por las referencias APA incluidas.")
blue("Antecedentes técnicos aplicados en PROYDEMO:",
     "el proyecto materializa estas tendencias mediante tres líneas concretas: (1) Retrieval-Augmented Generation (RAG) para fundamentar el feedback del agente en material de apoyo y reducir alucinaciones; (2) calificación híbrida que combina coincidencia exacta para preguntas cerradas con similitud semántica/NLP para abiertas; y (3) una arquitectura de microservicios que permite escalar e iterar la IA de forma independiente del backend transaccional. Estas decisiones conectan la literatura sobre IA en educación con una implementación verificable.")

# --- 1.8 MARCO TEÓRICO: contenido real ampliado ---
h("1.8 Marco Teórico (contenido ampliado)", 2)
ok("Las secciones originales (Neuroeducación, Microservicios, Next.js/Tailwind, NestJS, FastAPI, PostgreSQL, JWT, SCRUM y UML) son pertinentes y correctas.")
para("Se amplía el marco con los fundamentos que sustentan la implementación real de PROYDEMO:", size=10, color=GREY)
blue("Arquitectura Hexagonal (Puertos y Adaptadores).",
     "Propuesta por Alistair Cockburn, organiza el software en un núcleo de dominio rodeado por puertos (interfaces) y adaptadores (implementaciones). El dominio no depende de frameworks ni de la base de datos: define puertos como IQuizRepository o IOAuthVerifier, y la infraestructura provee adaptadores (repositorios TypeORM, AIClientService, verificadores OAuth). En PROYDEMO cada módulo NestJS se estructura en capas presentation/application/domain/infrastructure.")
blue("Clean Architecture.",
     "Formulada por Robert C. Martin, establece capas concéntricas donde la dependencia siempre apunta hacia el dominio (regla de dependencia). Las entidades y reglas de negocio son el centro; los casos de uso las orquestan; los frameworks y la UI quedan en el borde. Esto permite sustituir tecnologías (BD, proveedor LLM) sin reescribir el dominio.")
blue("Domain-Driven Design (DDD) táctico.",
     "Aporta bloques de construcción aplicados en el proyecto: Aggregate Root (User, Quiz, QuizSession) que garantiza invariantes; Value Object (Email, Role, Category, Difficulty, Language) inmutable y sin identidad; Entity con identidad propia; Repository como abstracción de persistencia; y Domain Event (QuizCompletedEvent, AchievementUnlockedEvent, etc.) emitido con EventEmitter2 para desacoplar efectos secundarios.")
blue("Patrones de diseño GoF aplicados.",
     "Strategy (calificación abierta por IA frente a cerrada local; selección de modelo en FastAPI), Factory (AIProviderFactory para Qwen/Mistral; model_factory en FastAPI), Adapter/Facade (AIClientService), Builder (construcción de prompts), Decorator (Guards, Interceptors y decoradores de NestJS), Composite (Quiz ◆── Questions) y Singleton (servicios con scope por defecto).")
blue("Retrieval-Augmented Generation (RAG).",
     "Técnica que combina recuperación de información con generación por LLM: antes de responder, el sistema recupera fragmentos relevantes desde un índice vectorial (FAISS) y los inyecta en el prompt, fundamentando la respuesta del modelo (Ollama Llama 3) y reduciendo alucinaciones. En PROYDEMO sustenta el feedback pedagógico y el tutor conversacional del microservicio FastAPI.")
blue("OAuth 2.0 / OpenID Connect.",
     "Protocolo de autorización delegada: el usuario se autentica ante un proveedor de identidad (Google/Microsoft) y la aplicación recibe un id_token que verifica antes de emitir su propio par de tokens JWT. En PROYDEMO, Auth.js (frontend) inicia el flujo y NestJS lo valida mediante IOAuthVerifier (Strategy/Factory), creando o vinculando la cuenta.")
blue("Arquitectura Orientada a Eventos (in-process).",
     "EventEmitter2 implementa un bus de eventos en proceso (patrón Observer/Pub-Sub): los casos de uso publican eventos de dominio y los listeners reaccionan de forma desacoplada. En el código, EndSession publica QuizCompletedEvent y QuizCompletedListener (módulo score) calcula y persiste el puntaje y verifica logros.")

h("1.9 Metodología (SCRUM)", 2)
ok("Uso de Scrum con sprints, Product Backlog, dailies, reviews, retrospectivas y Definition of Done: estructura correcta.")
no("La DoD que exige cobertura de pruebas ≥80% e integración E2E sin errores como hecho consumado es una meta declarada; debe respaldarse con evidencias antes de afirmarla al 100%.")

h("1.10 Resultados y Discusión", 2)
ok("Calificación automática y feedback del agente IA: funcionales vía FastAPI (/grading/grade y /feedback/generate).")
blue("Resultados concretos verificables en el código:",
     "(1) flujo completo de evaluación operativo (crear, iniciar, responder y finalizar sesión); (2) calificación automática híbrida con fallback local; (3) generación de preguntas por IA con caché Cache-Aside; (4) ranking global/por categoría y desbloqueo de logros; (5) autenticación JWT + OAuth con control de acceso por roles; (6) batería de pruebas automatizadas (Jest en backend y frontend, Pytest en FastAPI, Playwright para E2E del frontend).")
para("Discusión: la externalización de la IA en un microservicio y la arquitectura hexagonal facilitaron la evolución y las pruebas del sistema; el fallback local otorgó tolerancia a fallos del microservicio de IA, evitando que una caída de FastAPI interrumpa la evaluación.", size=10)
antes_corr("El petrolero de IA crea evaluaciones en un promedio de 8 segundos.",
           "El motor de IA genera evaluaciones en ~8 s en promedio (vía AIProviderFactory con proveedores Qwen/Mistral y caché Cache-Aside TTL 1 h; no usa Open Trivia DB, integración eliminada).")
no("Afirmar persistencia del feedback en una tabla de histórico: la tabla feedback_ia está DEFINIDA pero el código aún NO la escribe (SubmitAnswer no persiste feedback_ia). El feedback se entrega al usuario pero no se historiza todavía.")
antes_corr("…persistencia… de la información almacenada en PostgreSQL y Redis.",
           "…persistencia e integridad en PostgreSQL; Redis está configurado y se usa como caché (Cache-Aside vía cache-manager) para la generación de preguntas. Las colas Bull NO están implementadas.")

h("1.11 Conclusiones", 2)
ok("Conclusión de módulo robusto y escalable con Scrum: razonable para el alcance implementado.")
blue("Conclusión técnica:",
     "la separación dominio/infraestructura (hexagonal) y la externalización de la IA (microservicio FastAPI con RAG) demostraron ser decisiones acertadas: permitieron iterar la calificación y el feedback sin afectar el backend transaccional, y dotaron al sistema de resiliencia mediante fallback local.")

h("1.12 Recomendaciones", 2)
blue("Trabajo futuro priorizado:",
     "(1) implementar FeedbackIaRepository y persistir feedback_ia tras la calificación (habilita histórico docente, analítica y caché para no recomputar el LLM); (2) WebSocket/SSE real para notificaciones y streaming del tutor; (3) MailerModule/SMTP para el envío real de correos de verificación y restablecimiento (hoy solo se registra el enlace en logs); (4) activar el uso de email_verification_tokens (hoy VerifyEmail es un stub que trata el token como userId).")

h("1.13 Bibliografía / Referencias", 2)
ok("Referencias en APA 7 sobre neuroeducación, IA en educación y microservicios: pertinentes.")
nw("Se agregan referencias técnicas de las tecnologías implementadas (NestJS, FastAPI, Next.js, TypeORM, LangChain, FAISS, Ollama, PostgreSQL) en la sección 9 de este anexo.")

# ============================================================
# 2. REQUERIMIENTOS (revisados)
# ============================================================
doc.add_page_break()
h("2. REQUERIMIENTOS FUNCIONALES (REVISADOS)", 1)
para("Estado verificado contra el código de PROYDEMO.", color=GREY, italic=True, size=10)
rf_rows = [
 ("RF1","Acceso","Registro con correo único + hash de contraseña + par de tokens JWT", ("✅ Implementado (RegisterUseCase, bcrypt, JwtTokenService)", GREEN)),
 ("RF2","Acceso","Autenticación JWT con renovación (refresh) y expiración", ("✅ Implementado (LoginUseCase, RefreshTokenUseCase con rotación)", GREEN)),
 ("RF3","Acceso","Control de acceso por roles (estudiante, docente, admin)", ("✅ Implementado (enum Role: USER/TEACHER/ADMIN + Guards/@Roles)", GREEN)),
 ("RF4","Acceso","Inicio de sesión con Google y Microsoft (OAuth)", ("✅ Implementado (OAuthLoginUseCase + IOAuthVerifier)", GREEN)),
 ("RF5","Evaluación","Crear evaluaciones MC / V-F / abierta con dificultad y categoría", ("✅ Implementado (CreateQuizUseCase, entidades Quiz/Question)", GREEN)),
 ("RF6","Evaluación","Generación automática de evaluaciones con IA", ("✅ Implementado (GenerateAiQuestionsUseCase + AIProviderFactory Qwen/Mistral + Cache-Aside)", GREEN)),
 ("RF7","Evaluación","Ciclo de sesión: temporizador, preguntas secuenciales, marca de tiempo, fin automático", ("✅ Implementado (Start/Submit/EndSession; answers JSONB con timeTakenMs/answeredAt)", GREEN)),
 ("RF8","Evaluación","Calificación: cerradas por exact-match; abiertas por NLP/similitud (0–100)", ("✅ Implementado (SubmitAnswer: local MC/TF; FastAPI /grading/grade para abiertas)", GREEN)),
 ("RF9","Evaluación","Retroalimentación personalizada < 15 s", ("✅ Funcional (FastAPI /feedback/generate o feedback pre-cargado en la pregunta). ❌ NO se persiste en feedback_ia todavía.", GREEN)),
 ("RF10","Evaluación","Historial de evaluaciones con gráficos de evolución", ("✅ Implementado (ListMyHistory + WeaknessChart en frontend)", GREEN)),
 ("RF11","Evaluación","Resultados para docente por evaluación y por estudiante", ("✅ Implementado (ScoreModule + página admin/reports)", GREEN)),
 ("RF12","Asistente IA","Respuestas del tutor en streaming/tiempo real a la UI", ("❌ Parcial: el módulo assistant (FastAPI) existe, pero el streaming/WS hacia la UI NestJS no está cableado (no hay WebSocketGateway).", RED)),
 ("RF13","Evaluación","Puntuación con base + bonus por rapidez + bonus por dificultad; historial paginado", ("✅ Implementado (SubmitAnswer: BASE*DIFFICULTY_MULTIPLIER + speedBonus; SaveScore)", GREEN)),
 ("RF14","Calificación","Ranking global y por categoría, caché 60 s + notificación en tiempo real al mejorar", ("✅ Ranking + caché implementados (GetLeaderboard). ❌ Notificación en tiempo real NO (WS es stub).", GREEN)),
]
caption("Tabla", "Requerimientos funcionales verificados contra el código.")
table(["ID","Módulo","Requerimiento","Estado real"], [(a,b,c,d) for a,b,c,d in rf_rows])

doc.add_page_break()
h("3. REQUERIMIENTOS NO FUNCIONALES (REVISADOS)", 1)
rnf_rows = [
 ("RNF1","Seguridad","Hash seguro de contraseñas, JWT con expiración, HTTPS/TLS, cookies seguras", ("✅ Hash + JWT verificados. ⚠ HTTPS/TLS y flags de cookies dependen del despliegue (no del código).", GREEN)),
 ("RNF2","Rendimiento","Generación de preguntas < 10 s; feedback < 15 s; backend < 300 ms con 100 usuarios", ("⚠ Metas declaradas; no hay evidencia de pruebas de carga en el repositorio.", GREY)),
 ("RNF3","Escalabilidad","Escalado independiente por microservicio; tolerancia a fallos", ("✅ Arquitectura lo permite. 🆕 Resiliencia real: AIClientService cae a exact-match local si FastAPI falla.", GREEN)),
 ("RNF4","Usabilidad","Interfaz simple, responsive móvil", ("✅ Frontend Next.js + Tailwind responsive.", GREEN)),
 ("RNF5","Disponibilidad","≥ 99% en horario operativo", ("⚠ Meta operativa; no verificable desde el código.", GREY)),
 ("RNF6","Mantenibilidad","Buenas prácticas, cobertura > 80%, API documentada (Swagger)", ("✅ Arquitectura hexagonal + Swagger (@ApiTags). ❌ Cobertura > 80% no evidenciada.", GREEN)),
 ("RNF7","Accesibilidad","WCAG 2.1 AA (contraste, lectores de pantalla, teclado, prefers-reduced-motion)", ("❌ No implementado/verificado en el código. No hay auditoría WCAG ni atributos ARIA sistemáticos.", RED)),
]
caption("Tabla", "Requerimientos no funcionales verificados.")
table(["ID","Categoría","Requerimiento","Estado real"], [(a,b,c,d) for a,b,c,d in rnf_rows])

# ============================================================
# 4. DOCUMENTACION SCRUM
# ============================================================
doc.add_page_break()
h("4. DOCUMENTACIÓN ÁGIL (SCRUM)", 1)

h("4.1 Roles SCRUM", 2)
caption("Tabla", "Roles del equipo Scrum en PROYDEMO.")
table(["Rol","Responsabilidad"], [
 ("Product Owner","Prioriza el Product Backlog (módulos de acceso y evaluaciones), define criterios de aceptación."),
 ("Scrum Master","Facilita ceremonias, remueve impedimentos (p. ej. CORS NestJS↔FastAPI, configuración bcrypt)."),
 ("Equipo de Desarrollo","Implementa backend NestJS, microservicio FastAPI, frontend Next.js y base de datos PostgreSQL."),
])

h("4.2 Artefactos SCRUM", 2)
ok("Product Backlog, Sprint Backlog e Incremento están presentes en el documento.")
nw("Definition of Done (DoD) verificable: código fusionado a main vía PR, pruebas, documentación Swagger/README y persistencia en PostgreSQL según el esquema relacional.")

h("4.3 Ceremonias SCRUM", 2)
caption("Tabla", "Ceremonias Scrum aplicadas.")
table(["Ceremonia","Frecuencia","Propósito"], [
 ("Sprint Planning","Inicio de sprint","Selección y estimación de historias."),
 ("Daily Standup","Diaria (≤15 min)","Avances e impedimentos."),
 ("Sprint Review","Fin de sprint","Demostración del incremento."),
 ("Retrospectiva","Fin de sprint","Mejora continua del proceso."),
])

h("4.4 Sprint Backlog y Cronograma (revisado)", 2)
antes_corr("Sprint 1: Gestión de Acceso… recuperación de contraseña.",
           "Sprint 1 entrega: autenticación JWT, registro y rotación de refresh. Recuperación de contraseña: PARCIAL — se genera el token (password_reset_tokens, TTL 1 h) y se registra el enlace en logs; el envío real de correo (MailerModule/SMTP) está pendiente.")
caption("Tabla", "Sprints y velocidad reportada.")
table(["Sprint","Objetivo","HU","Velocidad"], [
 ("Sprint 1","Gestión de acceso (login/registro/JWT/OAuth)","01–03","11 pts"),
 ("Sprint 2","Creación y respuesta de evaluaciones (manual + IA)","04–08","31 pts"),
 ("Sprint 3","Calificación automática + retroalimentación IA","09–12","36 pts"),
 ("Sprint 4","Pruebas, documentación y cierre","13","—"),
])

h("4.5 Evidencias del desarrollo ágil", 2)
nw("Evidencias verificables en el repositorio: estructura modular hexagonal (apps/backend/src/modules), microservicio FastAPI (apps/ai-service/src/modules), historial de commits, contratos Swagger (@ApiTags/@ApiOperation) y los 10 diagramas drawIO actualizados.")

# ============================================================
# 5. DOCUMENTACION UML
# ============================================================
doc.add_page_break()
h("5. DOCUMENTACIÓN UML (DIAGRAMAS drawIO)", 1)
para("Los 10 diagramas de la carpeta documentos proyecto/diagrams/drawIO fueron revisados y corregidos para reflejar SOLO lo implementado en el código. A continuación se documenta cada uno: propósito, elementos representados y patrones rotulados.", color=GREY, italic=True, size=10)

uml = [
 ("Figura — Diagrama Entidad-Relación / DER (02_Diagrama_ER_DER)",
  "Modelar el esquema conceptual de datos del dominio y sus relaciones.",
  "11 entidades en notación Chen extendida; atributos con sus claves; cardinalidades (mín,máx). Las 4 tablas nuevas por RF (email_verification_tokens, password_reset_tokens, notifications, feedback_ia) se distinguen en magenta «NEW».",
  "Integridad referencial: FK dura con ON DELETE CASCADE únicamente en questions→quizzes (relación intra-agregado, Composite). El resto son FK suaves (columnas uuid sin @ManyToOne) que mantienen desacoplados los bounded contexts."),
 ("Figura — Modelo Relacional PostgreSQL (03_Modelo_Relacional)",
  "Representar el esquema físico tal como se materializa en PostgreSQL.",
  "Tipos reales (uuid, varchar(n), text, boolean, int, float, timestamptz, jsonb), ENUMs nativos, UNIQUE e índices @Index alineados al código TypeORM.",
  "Corrección clave: notifications usa un índice COMPUESTO (user_id, is_read), NO un índice parcial. token_hash es UNIQUE en ambos tokens (Idempotency Key)."),
 ("Figura — Diagrama de Normalización (04_Diagrama_Normalizacion)",
  "Demostrar el cumplimiento de las formas normales y justificar las desnormalizaciones.",
  "Matriz de cumplimiento 1FN/2FN/3FN/BCNF para las 11 tablas y la explicación de cada decisión.",
  "5 desnormalizaciones controladas: scores.accuracy, questions.language, quiz_sessions.answers (JSONB), questions.options (JSONB) y feedback_ia.is_correct, cada una con su justificación de rendimiento/atomicidad."),
 ("Figura — Diagrama de Clases UML (05_Diagrama_Clases_UML)",
  "Mostrar la estructura estática del backend según arquitectura hexagonal.",
  "Capas Dominio (entidades, value objects), Aplicación (casos de uso reales por módulo), Infraestructura (6 repositorios TypeORM, AIClientService, AIProviderFactory, JwtTokenService) y Presentación (controladores). Métodos reales: isExpired/isUsed/markUsed en tokens y markAsRead en Notification.",
  "Estereotipos «Aggregate Root», «Value Object», «Repository», «Adapter», «Facade», «Strategy», «Factory». Se eliminaron clases inexistentes (MailerService, use-cases de Feedback, repos de notification/feedback_ia); FeedbackIA y Notification quedan solo como entidad."),
 ("Figura — Diagrama de Casos de Uso (06_Casos_de_Uso)",
  "Describir las interacciones funcionales entre actores y el sistema.",
  "Actores: Estudiante, Docente, Administrador, Sistema OAuth (Google/Microsoft) y Servicio IA (FastAPI). Casos de uso reales de acceso, evaluación, calificación, ranking e historial, con relaciones «include»/«extend».",
  "Se eliminaron los actores Open Trivia DB (integración retirada) y SMTP Provider (no implementado), y los casos de uso de notificaciones persistentes, feedback histórico y cron de tokens (no existen en código)."),
 ("Figura — Diagrama de Secuencia (07_Diagrama_Secuencias)",
  "Mostrar la interacción temporal de tres flujos: Login OAuth, Resolver evaluación y Crear/Publicar evaluación.",
  "Líneas de vida Next.js/Auth.js, NestJS, FastAPI y PostgreSQL. Login OAuth: verificación de id_token y emisión de JWT. Resolver quiz: calificación abierta vía FastAPI o local, con feedback. Crear evaluación: generación IA con AIProviderFactory + Cache-Aside.",
  "Notas de patrones: «Strategy», «Adapter/ACL», «Observer» (EventEmitter2), «Command», «Cache-Aside» y resiliencia por fallback local. Sin notificaciones WS ni persistencia de feedback_ia (no implementadas)."),
 ("Figura — Arquitectura de Microservicios C4 (08_Arquitectura_Microservicios)",
  "Vista de contenedores (nivel C4) del sistema distribuido.",
  "Frontend Next.js (BFF), Backend NestJS (7 módulos; notifications y feedback marcados PARCIAL), microservicio FastAPI (grading, feedback, analytics, assistant), PostgreSQL (11 tablas), Redis (caché), OAuth providers y Ollama.",
  "Patrones por contenedor: «BFF», «ACL», «RAG», «Adapter», «Pub/Sub in-process». Se muestran las dos rutas de IA (Qwen/Mistral para generación; AIClientService→FastAPI para calificación/feedback). Sin SMTP, Mailer, Open Trivia ni Bull (PREVISTO)."),
 ("Figura — Diagrama de Estados de datos (10_Diagrama_Estados)",
  "Modelar el ciclo de vida (patrón State) de las entidades con estado.",
  "quiz_sessions (in_progress→completed|abandoned); auth_sessions (ACTIVA→REVOCADA|EXPIRADA); email_verification_tokens y password_reset_tokens (ACTIVO→USADO|EXPIRADO vía used_at/expires_at); notifications (NO_LEÍDA→LEÍDA vía markAsRead).",
  "Estereotipo «State Pattern» en cada máquina. feedback_ia se documenta SIN máquina de estados, pues no posee columna de estado en la base de datos."),
 ("Figura — Diagrama de Secuencia: Crear Evaluación (12_Secuencia_Crear_Evaluacion)",
  "Detallar el flujo de creación de evaluación manual y por IA.",
  "Docente → controlador → CreateQuizUseCase → repositorio (guarda quiz + questions en cascada) → emit QuizCreatedEvent. Rama IA: GenerateAiQuestionsUseCase → AIProviderFactory (Qwen|Mistral) con caché HIT/MISS y fallback entre proveedores.",
  "Patrones «Command», «Factory», «Cache-Aside», «Composite» (Quiz◆──Questions) y «Observer» (QuizCreatedEvent)."),
 ("Figura — Diagrama de Componentes (16_Componentes_v2)",
  "Mostrar la organización de componentes y dependencias internas.",
  "7 módulos NestJS con sus 4 capas hexagonales, las 11 tablas mapeadas a su módulo, AIClientService como ACL hacia FastAPI, AIProviderFactory (Qwen/Mistral) en quiz/infrastructure y EventEmitter2 con el único listener real QuizCompletedListener.",
  "Se marcan como «PREVISTO / no implementado»: WS client/SSE/NotificationsGateway, FeedbackIaRepository con caché y MailerService→SMTP."),
]
for name, prop, elem, pat in uml:
    multi([(name, BLACK, True)], size=10)
    multi([("Propósito: ", BLACK, True), (prop, BLACK, False)], size=10)
    multi([("Elementos: ", BLACK, True), (elem, BLACK, False)], size=10)
    multi([("Patrones / notas: ", BLACK, True), (pat, BLACK, False)], size=10)
    caption("Figura", name.split(" — ")[-1])
    para()
nw("Cobertura de los diagramas UML estándar solicitados: Casos de uso (06) ✓ · Clases (05) ✓ · Secuencia (07 y 12) ✓ · Entidad-Relación (02) ✓ · Arquitectura del sistema (08 y 16) ✓ · Estados (10) ✓. El Diagrama de Actividades se documenta a continuación como complemento textual para su modelado en drawIO.")

h("5.1 Diagrama de Actividades (flujo principal — Resolver evaluación)", 2)
para("Flujo de actividad del caso 'Responder evaluación con calificación IA' (descripción textual para modelar en drawIO):", size=10, color=GREY)
acts = ["Inicio → Estudiante inicia sesión de quiz (StartSession; estado in_progress).",
 "Estudiante responde una pregunta (SubmitAnswer).",
 "Decisión [tipo de pregunta]: abierta → calificar con FastAPI (/grading/grade); cerrada → exact-match local.",
 "Decisión [FastAPI disponible]: no → fallback local exact-match (resiliencia).",
 "Calcular puntaje (base + bonus rapidez + bonus dificultad) y registrar respuesta en answers (JSONB).",
 "Decisión [respuesta incorrecta]: sí → feedback pedagógico (pregunta.feedback o FastAPI /feedback/generate).",
 "¿Quedan preguntas? sí → repetir; no → EndSession (estado completed).",
 "EndSession emite QuizCompletedEvent → QuizCompletedListener → SaveScore + CheckAchievements → Fin."]
for i,a in enumerate(acts,1): para(f"{i}. {a}", size=10)

# ============================================================
# 6. BASE DE DATOS
# ============================================================
doc.add_page_break()
h("6. BASE DE DATOS (PostgreSQL)", 1)
para("El esquema físico tiene 11 tablas. 7 ya existentes y 4 nuevas por requerimiento: email_verification_tokens, password_reset_tokens, notifications y feedback_ia.", size=10, color=GREY)

h("6.1 Explicación general y relaciones", 2)
para("El modelo se organiza por bounded contexts (DDD). El usuario es el eje del que dependen, mediante FK suaves (uuid), las demás entidades; el único agregado con FK física en cascada es Evaluación → Pregunta.", size=10)
caption("Tabla", "Tablas agrupadas por bounded context.")
table(["Bounded context","Tablas","Rol"], [
 ("Users","users","Identidad y perfil; raíz de agregado Usuario."),
 ("Auth","auth_sessions, email_verification_tokens 🆕, password_reset_tokens 🆕","Sesiones JWT y tokens efímeros single-use."),
 ("Evaluación","quizzes, questions, quiz_sessions","Agregado Evaluación (Quiz◆──Questions) e Intento con respuestas embebidas."),
 ("Gamificación","scores, achievements","Puntajes inmutables y logros desbloqueados."),
 ("Notificación","notifications 🆕","Persistencia de notificaciones (capa de aplicación PARCIAL)."),
 ("Feedback","feedback_ia 🆕","Histórico de feedback del LLM (tabla definida, aún no escrita)."),
])
para("Relaciones principales (cardinalidad): un USUARIO tiene N auth_sessions, N tokens, es autor de N quizzes, juega N quiz_sessions y posee N scores y N achievements. Un QUIZ contiene N questions (1:N en cascada) y origina N quiz_sessions. Una quiz_session genera 1 score. Las respuestas (SessionAnswer[]) viven embebidas como JSONB dentro de quiz_sessions.answers, no como tabla.", size=10)

h("6.2 Reglas de integridad", 2)
para("• Integridad de entidad: toda tabla tiene PK uuid (PrimaryGeneratedColumn).", size=10)
para("• Integridad referencial dura: questions.quiz_id → quizzes ON DELETE CASCADE (intra-agregado).", size=10)
para("• Integridad referencial suave: el resto de relaciones usa columnas uuid sin FK física (desacople entre bounded contexts).", size=10)
para("• Unicidad: users.email UNIQUE; achievements UNIQUE(user_id, code); token_hash UNIQUE en ambos tokens (Idempotency Key).", size=10)
para("• Dominio: ENUMs nativos PostgreSQL para role, category, difficulty, language, question type, session status, achievement code, notification type y grading strategy.", size=10)

h("6.3 Diccionario de datos", 2)
dd = {
 "users (USUARIO)": [
   ("id","uuid","PK","Identificador del usuario."),
   ("email","varchar(320)","UNIQUE","Correo normalizado en minúsculas."),
   ("password_hash","varchar(255)","NOT NULL","Hash bcrypt de la contraseña."),
   ("first_name / last_name","varchar(80)","NOT NULL","Nombres y apellidos."),
   ("role","users_role_enum","NOT NULL def USER","USER, TEACHER o ADMIN."),
   ("is_active","boolean","def true","Habilitación (soft-disable)."),
   ("is_email_verified","boolean","def false","Verificación de email."),
   ("created_at / updated_at","timestamptz","auto","Auditoría."),
 ],
 "auth_sessions (SESIÓN)": [
   ("id","uuid","PK","Sesión (par access/refresh)."),
   ("user_id","uuid","FK suave","Usuario propietario."),
   ("refresh_token_hash","varchar(255)","NOT NULL","Hash del refresh token."),
   ("user_agent / ip_address","varchar","NULL","Trazabilidad del dispositivo."),
   ("expires_at","timestamptz","NOT NULL","Vencimiento."),
   ("is_revoked","boolean","def false","Revocación (logout/rotación)."),
   ("created_at","timestamptz","auto","Creación."),
 ],
 "email_verification_tokens 🆕": [
   ("id","uuid","PK","Token de verificación."),
   ("user_id","uuid","FK suave","Usuario."),
   ("token_hash","varchar(255)","UNIQUE","Hash del token (single-use)."),
   ("expires_at","timestamptz","NOT NULL","Vencimiento."),
   ("used_at","timestamptz","NULL","Marca de uso (NULL = activo)."),
   ("created_at","timestamptz","auto","Creación. (Nota: tabla definida; VerifyEmail aún es stub.)"),
 ],
 "password_reset_tokens 🆕": [
   ("id","uuid","PK","Token de recuperación."),
   ("user_id","uuid","FK suave","Usuario."),
   ("token_hash","varchar(255)","UNIQUE","Hash single-use (TTL 1 h)."),
   ("expires_at / used_at","timestamptz","NOT NULL / NULL","Vencimiento / uso."),
   ("created_at","timestamptz","auto","Creación."),
 ],
 "quizzes (EVALUACIÓN)": [
   ("id","uuid","PK","Evaluación (agregado raíz)."),
   ("title","varchar(160)","NOT NULL","Título."),
   ("description","text","NULL","Descripción."),
   ("category","quiz_category_enum","def general","Categoría temática."),
   ("difficulty","quiz_difficulty_enum","def medium","easy/medium/hard."),
   ("language","quiz_language_enum","def en","en/es."),
   ("author_id","uuid","FK suave","Docente autor."),
   ("source","varchar(32)","def custom","Origen (custom/ai)."),
   ("time_per_question_seconds","int","def 30","Tiempo por pregunta."),
   ("is_published","boolean","def false","Publicada."),
   ("created_at / updated_at","timestamptz","auto","Auditoría."),
 ],
 "questions (PREGUNTA)": [
   ("id","uuid","PK","Pregunta."),
   ("quiz_id","uuid","FK DURA CASCADE","Evaluación (ON DELETE CASCADE)."),
   ("text","text","NOT NULL","Enunciado."),
   ("type","questions_type_enum","def multiple_choice","multiple_choice/true_false/open_answer."),
   ("options","jsonb","NULL","Opciones (array)."),
   ("correct_answer","text","NOT NULL","Respuesta correcta/referencia."),
   ("difficulty / language","enum","def","Dificultad e idioma."),
   ("position","int","def 0","Orden."),
   ("time_limit_seconds","int","NULL","Override de tiempo."),
   ("explanation / feedback","text","NULL","Explicación y feedback pre-cargado."),
 ],
 "quiz_sessions (INTENTO)": [
   ("id","uuid","PK","Sesión de juego."),
   ("user_id / quiz_id","uuid","FK suave","Estudiante / evaluación."),
   ("status","quiz_sessions_status_enum","def in_progress","in_progress/completed/abandoned."),
   ("answers","jsonb","def '[]'","SessionAnswer[] embebido (RESPUESTA)."),
   ("total_score","float","def 0","Puntaje total."),
   ("correct_count","int","def 0","Aciertos."),
   ("started_at","timestamptz","auto","Inicio."),
   ("completed_at","timestamptz","NULL","Cierre."),
 ],
 "scores (SCORE)": [
   ("id","uuid","PK","Resultado inmutable."),
   ("user_id / quiz_id / session_id","uuid","FK suave","Relaciones."),
   ("points","float","NOT NULL","Puntos."),
   ("correct_count / total_questions","int","NOT NULL","Aciertos / total."),
   ("accuracy","float","NOT NULL","Precisión (desnormalizada para ranking)."),
   ("created_at","timestamptz","auto","Creación."),
 ],
 "achievements (LOGRO)": [
   ("id","uuid","PK","Logro."),
   ("user_id","uuid","FK suave","Usuario."),
   ("code","achievements_code_enum","NOT NULL","first_quiz, perfect_score, streak_3/10, speed_demon, points_1000/5000."),
   ("title","varchar(160)","NOT NULL","Título."),
   ("description","text","NULL","Descripción."),
   ("unlocked_at","timestamptz","auto","Desbloqueo. UNIQUE(user_id, code)."),
 ],
 "notifications 🆕": [
   ("id","uuid","PK","Notificación persistente."),
   ("user_id","uuid","FK suave","Usuario."),
   ("type","notification_type_enum","NOT NULL","ACHIEVEMENT/SCORE/EMAIL_VERIFY/PASSWORD_RESET/QUIZ_PUBLISHED/LOGIN_DEVICE/SYSTEM."),
   ("title","varchar(255)","NOT NULL","Título."),
   ("body","text","NOT NULL","Cuerpo."),
   ("payload","jsonb","NULL","Datos según tipo."),
   ("is_read","boolean","def false","Leída."),
   ("read_at","timestamptz","NULL","Marca de lectura."),
   ("created_at","timestamptz","auto","Creación. Índice COMPUESTO (user_id, is_read). (Nota: solo entidad; WS/SSE stub.)"),
 ],
 "feedback_ia 🆕": [
   ("id","uuid","PK","Feedback del LLM."),
   ("session_id / question_id / user_id","uuid","FK suave","Relaciones."),
   ("content","text","NOT NULL","Mensaje pedagógico."),
   ("suggestion","text","NULL","Recomendación."),
   ("score","float","NOT NULL","Puntaje 0..1."),
   ("is_correct","boolean","NOT NULL","Proyección de answers[].isCorrect (desnormalizada)."),
   ("confidence","float","NULL","Confianza del LLM."),
   ("model","varchar(64)","NOT NULL","Modelo usado."),
   ("strategy_used","grading_strategy_enum","NOT NULL","similarity/llm_rubric/exact_match."),
   ("latency_ms","int","NULL","Latencia. (Nota: tabla definida; aún no escrita por el código.)"),
 ],
}
for tname, cols in dd.items():
    color = BLUE if "🆕" in tname else BLACK
    multi([(tname, color, True)])
    caption("Tabla", f"Diccionario de datos — {tname.split(' (')[0].replace(' 🆕','')}.")
    table(["Columna","Tipo","Restricción/Índice","Descripción"], cols)
    para()

h("6.4 Normalización (1FN, 2FN, 3FN)", 2)
para("Primera Forma Normal (1FN): todas las tablas tienen PK y atributos atómicos a nivel relacional. Excepción controlada: questions.options y quiz_sessions.answers usan JSONB por atomicidad lógica y lectura atómica (1FN/BCNF relajadas de forma justificada).", size=10)
para("Segunda Forma Normal (2FN): no hay dependencias parciales; las PK son uuid simples (no compuestas), por lo que todo atributo depende de la clave completa.", size=10)
para("Tercera Forma Normal (3FN): se eliminaron dependencias transitivas, salvo desnormalizaciones controladas documentadas.", size=10)
caption("Tabla", "Desnormalizaciones controladas (justificadas).")
table(["Columna","Forma relajada","Justificación"], [
 ("scores.accuracy","3FN","Derivada de correct_count/total_questions; acelera el ranking O(log N)."),
 ("questions.language","3FN","Dependencia transitiva con quizzes.language; evita JOIN para i18n."),
 ("quiz_sessions.answers (JSONB)","BCNF","Lectura atómica de la sesión completa."),
 ("questions.options (JSONB)","1FN","Atomicidad lógica del conjunto de opciones."),
 ("feedback_ia.is_correct","3FN","Proyección queryable e indexable de answers[].isCorrect."),
])

# ============================================================
# 7. FIGMA / UI-UX
# ============================================================
doc.add_page_break()
h("7. DOCUMENTACIÓN FIGMA (PROTOTIPADO Y UI/UX)", 1)
nw("Sección de diseño basada en el frontend Next.js implementado (app router + Tailwind + Redux Toolkit + Auth.js v5).")
h("7.1 Prototipado y diseño UI/UX", 2)
para("El prototipo en Figma cubre los flujos de acceso (login/registro/OAuth), creación de evaluación, resolución de evaluación con feedback IA, perfil/progreso, leaderboard y paneles docente/admin. La codificación del frontend respeta esos prototipos.", size=10)
h("7.2 Flujo de navegación", 2)
para("Landing/Login → (OAuth Google/Microsoft o credenciales) → Dashboard según rol → [Estudiante] Quiz / Resolver / Perfil-Progreso / Leaderboard · [Docente] Crear evaluación / Mis evaluaciones / Reportes · [Admin] Usuarios / Reportes.", size=10)
h("7.3 Descripción de pantallas (implementadas)", 2)
caption("Tabla", "Pantallas del frontend Next.js.")
table(["Pantalla","Ruta","Descripción"], [
 ("Login / Registro","/login, /register","Acceso por credenciales u OAuth (SessionProvider Auth.js)."),
 ("Dashboard Docente","/dashboard/docente","Resumen y accesos del docente."),
 ("Crear Evaluación","/quiz/create","Formulario manual + generación con IA."),
 ("Listado / Resolver Quiz","/quiz","Tarjetas (QuizCard/QuizGrid) y resolución de la evaluación."),
 ("Perfil / Progreso","/profile","Datos del usuario y gráfico de debilidades (WeaknessChart)."),
 ("Leaderboard","/leaderboard","Ranking global y por categoría."),
 ("Evaluaciones del Docente","/teacher/quizzes","Gestión de evaluaciones propias (QuizAdminTable)."),
 ("Reportes / Usuarios (Admin)","/admin/reports, /admin/users","Analítica y administración de usuarios."),
])
h("7.4 Experiencia de usuario y evidencias", 2)
para("La UX prioriza el acceso a funciones clave en pocas interacciones y el diseño responsive. Evidencias: archivo Figma del equipo (enlace a incluir) y las pantallas implementadas listadas arriba.", size=10)
no("Conformidad WCAG 2.1 AA declarada en el documento: no verificada en el código; se recomienda auditoría de accesibilidad antes de afirmarla.")

# ============================================================
# 8. AGENTE IA: ARQUITECTURA Y COMO FUNCIONA
# ============================================================
doc.add_page_break()
h("8. AGENTE IA: ARQUITECTURA Y CÓMO FUNCIONA (FEEDBACK)", 1)
nw("Sección nueva que documenta el microservicio de IA (FastAPI) y el flujo de calificación y retroalimentación.")

h("8.1 Visión general", 2)
para("El agente de IA vive en un microservicio independiente (apps/ai-service) construido con FastAPI siguiendo arquitectura hexagonal. NestJS se comunica con él por REST/HTTP a través de AIClientService, que actúa como Anti-Corruption Layer (ACL) y Adaptador: traduce el dominio NestJS al contrato del servicio de IA y aísla a NestJS de los detalles del LLM.", size=10)

h("8.2 Módulos del microservicio FastAPI", 2)
caption("Tabla", "Módulos del microservicio de IA (FastAPI).")
table(["Módulo","Función","Componentes clave"], [
 ("grading","Calificación de respuestas","grade_answer, batch_grade; modelos exact_match / similarity / nlp + model_factory (Strategy)."),
 ("feedback","Retroalimentación pedagógica","generate_feedback, analyze_weaknesses, generate_recommendation, generate_study_plan; ollama_client + rag_retriever + faiss_store."),
 ("analytics","Analítica de aprendizaje","classify_difficulty, detect_anomalies."),
 ("assistant","Tutor conversacional","chat_with_agent, get_conversation; tutor_agent (LangChain) + vector store FAISS + conversation_repo."),
])

h("8.3 RAG (Retrieval-Augmented Generation)", 2)
para("El módulo feedback/assistant usa RAG: FAISS como almacén vectorial, LangChain para orquestar el prompt y recuperar contexto relevante, y Ollama (Llama 3) como modelo local. Esto permite respuestas pedagógicas fundamentadas en material de apoyo, no solo en el conocimiento paramétrico del modelo.", size=10)

h("8.4 Flujo de feedback (cómo funciona)", 2)
fb_steps = [
 "El estudiante envía una respuesta (SubmitAnswerUseCase en NestJS).",
 "Estrategia de calificación: si la pregunta es abierta, NestJS llama a FastAPI POST /api/v1/grading/grade (con el JWT del usuario); si es cerrada, califica localmente por exact-match.",
 "Resiliencia (Circuit-Breaker suave): si FastAPI no responde, AIClientService cae a exact-match local y continúa el flujo sin romperse.",
 "Si la respuesta es incorrecta, se genera feedback: primero se prefiere el feedback pre-cargado en la pregunta; si no existe, NestJS llama a FastAPI POST /api/v1/feedback/generate.",
 "En FastAPI, generate_feedback construye el prompt (Builder), recupera contexto con RAG (FAISS) y consulta a Ollama (Llama 3); devuelve mensaje + sugerencia + referencias.",
 "El feedback se devuelve a la UI. Estado actual: NO se persiste en la tabla feedback_ia (definida pero aún sin repositorio ni escritura).",
 "Análisis de debilidades: AIClientService.analyzeWeaknesses llama a FastAPI /feedback/weaknesses; el frontend lo muestra en WeaknessChart.",
]
for i,s in enumerate(fb_steps,1): para(f"{i}. {s}", size=10)

h("8.5 Dos rutas de IA (importante)", 2)
para("PROYDEMO tiene dos integraciones de IA distintas, que no deben confundirse:", size=10)
multi([("Ruta 1 — Generación de preguntas: ", BLACK, True), ("dentro de quiz.module, vía AIProviderFactory (patrón Factory) con proveedores Qwen y Mistral (clientes HTTP) + Cache-Aside (TTL 1 h) + fallback entre proveedores. NO pasa por el microservicio FastAPI.", BLACK, False)])
multi([("Ruta 2 — Calificación y feedback: ", BLACK, True), ("dentro de ai.module, vía AIClientService (ACL) → microservicio FastAPI (/grading, /feedback). Con fallback local.", BLACK, False)])

h("8.6 Patrones aplicados en el agente IA", 2)
para("Adapter + Facade + ACL (AIClientService), Strategy (selección de modelo de calificación), Factory (model_factory en FastAPI; AIProviderFactory en NestJS), Builder (construcción de prompts), RAG, Cache-Aside (generación de preguntas) y Resiliencia/Fallback.", size=10)

h("8.7 Brechas y recomendaciones del agente IA", 2)
no("La persistencia histórica del feedback (tabla feedback_ia) no está activa: falta el repositorio y la escritura desde SubmitAnswer.")
no("El streaming en tiempo real del tutor hacia la UI no está cableado (no hay WebSocketGateway funcional).")
nw("Recomendación: implementar FeedbackIaRepository + escritura tras la calificación (habilita histórico docente y caché para evitar recomputar el LLM), y un WebSocket/SSE real para streaming y notificaciones.")

# ============================================================
# 9. REFERENCIAS TECNICAS (APA 7)
# ============================================================
doc.add_page_break()
h("9. PLAN DE PRUEBAS (REVISADO)", 1)
para("El proyecto implementa una estrategia de pruebas en pirámide (unitarias > integración > funcionales/E2E) sobre los tres componentes. La tabla resume las pruebas REALMENTE presentes en el repositorio, con su herramienta y carpeta de evidencia.", color=GREY, italic=True, size=10)
ok("Existen pruebas automatizadas en backend (Jest), microservicio IA (Pytest) y frontend (Jest + Playwright), con configuración versionada (jest.config.ts, jest.e2e.config.ts, pytest.ini, playwright.config.ts).")
caption("Tabla", "Plan de pruebas verificado contra el repositorio.")
table(["Nivel","Componente","Herramienta real","Evidencia (carpeta)"], [
 ("Unitaria","Backend NestJS","Jest","apps/backend/src/**/*.spec.ts (≈27 specs)"),
 ("Unitaria","Microservicio IA","Pytest","apps/ai-service/tests/unit/** (modelos, schemas, use_cases)"),
 ("Unitaria","Frontend","Jest + React Testing Library","apps/frontend-next/__tests__/integration/*.test.tsx"),
 ("Integración","Backend NestJS","Jest + Supertest","apps/backend/__tests__/integration/** (auth login/refresh/register; notifications/sse)"),
 ("Integración","Microservicio IA","Pytest + HTTPX","apps/ai-service/tests/integration/** (grading, feedback, assistant, analytics)"),
 ("Funcional E2E","Backend NestJS","Jest e2e","apps/backend/__tests__/functional/** (auth-flow, full-game, quiz-flow, rbac, rate-limiting)"),
 ("Funcional E2E","Microservicio IA","Pytest","apps/ai-service/tests/functional/** (grading, feedback, assistant, auth_protection, batch)"),
 ("Funcional E2E","Frontend","Playwright","apps/frontend-next/__tests__/functional/** (auth, quiz-flow, leaderboard, navigation, protected-routes, session-expiry, ai-feedback, dark-mode)"),
])
para("Correcciones al plan de pruebas del documento original:", bold=True, size=10)
no("gRPC: no aplica. Las pruebas de integración entre microservicios validan comunicación REST/HTTP, no gRPC.")
no("Accesibilidad WCAG 2.1 AA: no existen pruebas de accesibilidad automatizadas en el repositorio.")
no("Locust / pruebas de carga: no hay scripts de carga en el repositorio; las metas de rendimiento (300 ms, 100 usuarios) son declaradas, no evidenciadas.")
no("Cobertura ≥ 80 %: las herramientas permiten medir cobertura, pero el porcentaje real debe medirse y evidenciarse antes de afirmarlo.")

doc.add_page_break()
h("10. REFERENCIAS TÉCNICAS (APA 7) — NUEVAS", 1)
refs = [
 "NestJS. (2024). NestJS Documentation. https://docs.nestjs.com",
 "FastAPI. (2024). FastAPI Documentation. https://fastapi.tiangolo.com",
 "Vercel. (2024). Next.js Documentation. https://nextjs.org/docs",
 "TypeORM. (2024). TypeORM Documentation. https://typeorm.io",
 "LangChain. (2024). LangChain Documentation. https://python.langchain.com",
 "Meta AI / Ollama. (2024). Ollama & Llama 3. https://ollama.com",
 "Johnson, J., Douze, M., & Jégou, H. (2019). Billion-scale similarity search with GPUs (FAISS). IEEE Transactions on Big Data.",
 "PostgreSQL Global Development Group. (2024). PostgreSQL 18 Documentation. https://www.postgresql.org/docs",
]
for r in refs: para(r, size=10)
para()
para("Fin del anexo de correcciones.", color=GREY, italic=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)

# Forzar que Word actualice todos los campos (índices TOC/figuras/tablas) al abrir
settings = doc.settings.element
uf = OxmlElement('w:updateFields'); uf.set(qn('w:val'), 'true'); settings.append(uf)

doc.save(DST)
print("OK guardado:", DST)
print("paras:", len(doc.paragraphs), "tablas:", len(doc.tables))
