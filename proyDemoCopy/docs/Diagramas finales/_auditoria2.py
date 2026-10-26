# -*- coding: utf-8 -*-
"""Parte 2: secciones finales de auditoria al final de prueba.docx."""
from docx import Document
from docx.shared import RGBColor, Pt

SRC = "prueba.docx"
VERDE   = RGBColor(0x00, 0xB0, 0x50)
ROJO    = RGBColor(0xFF, 0x00, 0x00)
MORADO  = RGBColor(0x70, 0x30, 0xA0)
NARANJA = RGBColor(0xED, 0x7D, 0x31)
AZUL    = RGBColor(0x00, 0x70, 0xC0)
NEGRO   = RGBColor(0x00, 0x00, 0x00)

doc = Document(SRC)

def H(text, level=1):
    doc.add_heading(text, level=level)

def P(text, rgb=NEGRO, bold=False, bullet=False, size=11):
    p = doc.add_paragraph()
    if bullet:
        text = "• " + text
    r = p.add_run(text)
    r.font.color.rgb = rgb
    r.bold = bold
    r.font.size = Pt(size)
    return p

doc.add_page_break()

# ============ LEYENDA ============
H("Leyenda de Revision de Auditoria", 1)
P("Verde: informacion correcta verificada contra el aplicativo PROYDEMO.", VERDE)
P("Rojo: texto del documento que NO cumple con lo implementado; se conserva como evidencia del hallazgo.", ROJO)
P("Morado: correccion con el texto que si corresponde al aplicativo.", MORADO)
P("Naranja: explicacion del porque el texto en rojo no cumple, u observaciones de auditoria.", NARANJA)
P("Azul: contenido nuevo agregado durante la auditoria (requerimientos, historias, pruebas faltantes).", AZUL)

# ============ OBSERVACIONES LOGROS ============
H("Observaciones y Explicaciones de Auditoria - Logros Desbloqueables", 1)
P("Verificacion realizada contra el codigo fuente de PROYDEMO. El modulo de Logros Desbloqueables "
  "esta IMPLEMENTADO UNICAMENTE EN LA CAPA DE PERSISTENCIA DEL BACKEND (NestJS); no constituye, "
  "a la fecha de la auditoria, una funcionalidad visible de extremo a extremo para el usuario final.", NARANJA, bold=True)
P("Implementado y verificado en el codigo:", NARANJA, bold=True)
P("Entidad Achievement con indice unico (user_id, code): "
  "apps/backend/src/modules/score/domain/entities/achievement.entity.ts.", NARANJA, bullet=True)
P("Enumeracion AchievementCode con 7 codigos (FIRST_QUIZ, PERFECT_SCORE, STREAK_3, STREAK_10, "
  "SPEED_DEMON, POINTS_1000, POINTS_5000); solo 4 estan conectados a reglas activas.", NARANJA, bullet=True)
P("Motor de reglas y desbloqueo: check-achievements.use-case.ts, disparado por el evento "
  "QUIZ_COMPLETED (quiz-completed.listener.ts) al finalizar una sesion de evaluacion.", NARANJA, bullet=True)
P("Persistencia y deduplicacion de logros: achievement.repository.ts (metodos unlock / hasAchievement).", NARANJA, bullet=True)
P("Emision del evento de dominio ACHIEVEMENT_UNLOCKED.", NARANJA, bullet=True)
P("Prueba unitaria que cubre el desbloqueo y los umbrales de puntos: "
  "check-achievements.use-case.spec.ts (4 casos).", NARANJA, bullet=True)
P("Brechas detectadas (NO implementado):", NARANJA, bold=True)
P("No existe endpoint REST que exponga los logros al cliente (listByUser definido pero nunca invocado).", NARANJA, bullet=True)
P("El evento ACHIEVEMENT_UNLOCKED se emite pero no tiene suscriptor; NotificationType.ACHIEVEMENT "
  "esta declarado pero nunca se genera una notificacion de ese tipo.", NARANJA, bullet=True)
P("No existe interfaz de usuario (frontend) que muestre logros, insignias o medallas.", NARANJA, bullet=True)
P("No hay migracion de base de datos; la tabla achievements depende de synchronize.", NARANJA, bullet=True)
P("El microservicio de IA (FastAPI) no contiene logica de logros.", NARANJA, bullet=True)
P("Conclusion: los logros se desbloquean y persisten en base de datos al completar un quiz, pero el "
  "usuario no puede visualizarlos. Por tanto, toda afirmacion del documento que sugiera acceso o "
  "visualizacion de logros por el usuario fue marcada y corregida.", NARANJA, bold=True)

# ============ RESULTADOS DE LA AUDITORIA ============
H("Resultados de la Auditoria", 1)

H("1. Funcionalidades verificadas (implementadas y documentadas)", 2)
for s in [
 "Registro con correo/contrasena (bcrypt) y emision de JWT de acceso (15 min) y refresh (7 dias).",
 "Autenticacion JWT, proteccion de recursos por token y renovacion de sesion (rotacion de refresh).",
 "Control de acceso por roles (estudiante, docente, administrador) mediante guards.",
 "Inicio de sesion OAuth con Google y Microsoft (verificacion real de id_token).",
 "Creacion de evaluaciones por el docente (seleccion multiple, verdadero/falso, abierta; dificultad, categoria, puntaje).",
 "Generacion de evaluaciones por IA (backend NestJS con proveedores Qwen/Mistral via Ollama).",
 "Ciclo de sesion de evaluacion: temporizador, respuestas secuenciales con marca de tiempo, cierre automatico.",
 "Calificacion: preguntas cerradas por coincidencia exacta; abiertas por similitud semantica/NLP (FastAPI).",
 "Calculo y persistencia de puntajes (orientado a eventos: QUIZ_COMPLETED).",
 "Retroalimentacion pedagogica por IA (generate, weaknesses, study-plan) y asistente tutor.",
 "Historial de evaluaciones y vistas de progreso del estudiante.",
 "Clasificacion (leaderboard) global con cache de 60 s, filtrable por periodo y seccion.",
 "Administracion de usuarios por el administrador (listar, crear, editar, activar/desactivar, roles) y estadisticas.",
 "No funcionales: seguridad JWT y guards de rol, prevencion de inyeccion SQL (TypeORM + ParseUUIDPipe + ValidationPipe), rate limiting y cache.",
]:
    P(s, VERDE, bullet=True)

H("2. Funcionalidades documentadas pero NO implementadas (o parciales)", 2)
for s in [
 "Logros Desbloqueables de cara al usuario: persistidos en backend, pero sin API, sin notificacion y sin UI (ver Observaciones).",
 "Clasificacion 'por categoria tematica' (Req. funcional #14 e Historia 11): solo existe global, por periodo y por seccion.",
 "Entrega de notificaciones (SSE/WebSocket): la entidad y los eventos existen, pero el controlador SSE y el gateway estan vacios; no hay entrega real.",
 "Envio de correos (recuperacion de contrasena y verificacion de correo): los tokens existen pero el correo solo se registra en log; verificacion de correo es un stub (token = userId).",
 "Streaming real del asistente IA: el endpoint /assistant/chat/stream existe con SSE, pero es pseudo-streaming (palabra a palabra) y la conversacion es en memoria.",
 "Dashboard del docente con distribucion y promedios: en fase de implementacion.",
 "Metas de rendimiento (NFR) y cobertura >80%: no verificadas; multiples archivos de prueba estan vacios.",
 "Accesibilidad WCAG 2.1 AA: validada parcialmente (jest-axe en atomos/moleculas); teclado, contraste y cross-browser planificados.",
]:
    P(s, ROJO, bullet=True)

H("3. Funcionalidades implementadas pero NO documentadas (agregadas en Azul)", 2)
for s in [
 "Requerimiento funcional de Administracion de usuarios (agregado a la tabla, #15).",
 "Persistencia de Logros/Gamificacion en backend (agregado a la tabla, #16, con su alcance real).",
 "No funcional de rate limiting (ThrottlerModule) y cache-aside (agregado, #8).",
 "Prueba backend src/app.controller.spec.ts (agregada a la tabla de pruebas unitarias).",
 "Prueba de integracion backend notifications/sse.integration.spec.ts (agregada).",
]:
    P(s, AZUL, bullet=True)

H("4. Hallazgos encontrados", 2)
for s in [
 "Tabla de pruebas de integracion del frontend (T) listaba 6 archivos vacios (0 bytes) como si tuvieran evidencia: AuthFlow, QuizPage, QuizPlay, FeedbackPanel, AssistantChat, Leaderboard. Marcados en rojo.",
 "Tabla de pruebas funcionales del frontend incluia auth.spec.ts vacio. Marcado en rojo.",
 "Requerimiento #14 e Historia 11 afirman clasificacion 'por categoria', no implementada (solo global/periodo/seccion).",
 "Requerimientos #13 y #14 son practicamente duplicados (ambos describen ranking global con cache 60 s).",
 "El backlog de historias salta de la 11 a la 14 (faltan 12 y 13 en la numeracion).",
 "Multiples suites de prueba declaradas en el plan estan vacias: integracion frontend, funcionales (auth, leaderboard, navegacion, rutas protegidas, dark-mode), usabilidad/accesibilidad y rendimiento; integracion/funcionales/usabilidad/rendimiento del microservicio de IA.",
 "El plan menciona pruebas de rendimiento, pero los archivos correspondientes estan vacios.",
]:
    P(s, NARANJA, bullet=True)

H("5. Correcciones realizadas", 2)
for s in [
 "Coloreado de requerimientos funcionales y no funcionales y de historias de usuario verificados (verde).",
 "Marca en rojo del texto incorrecto, correccion en morado y explicacion en naranja para el requerimiento #14 y la historia 11 (clasificacion por categoria).",
 "Filas de pruebas sin evidencia marcadas en rojo; pruebas reales faltantes agregadas en azul.",
 "Referencia al modulo de Logros agregada en la introduccion (azul) con su alcance real.",
 "Notas de auditoria en naranja para rendimiento, mantenibilidad/cobertura y accesibilidad.",
]:
    P(s, MORADO, bullet=True)

H("6. Recomendaciones de mejora documental", 2)
for s in [
 "Diferenciar claramente lo IMPLEMENTADO de lo PLANIFICADO en cada seccion (logros, notificaciones, correo, streaming, dashboard docente).",
 "Unificar o eliminar el requerimiento duplicado (#13/#14) y corregir 'por categoria' por 'por periodo y seccion'.",
 "Renumerar el backlog de historias de usuario para eliminar el salto 11 -> 14.",
 "No listar como evidencia archivos de prueba vacios; reportar suites realmente ejecutadas con sus resultados.",
 "Documentar el modulo de Logros con su alcance actual (solo persistencia) y registrar las brechas (API, notificacion, UI) como trabajo futuro.",
 "Sustentar las metas de rendimiento y la cobertura >80% con evidencia ejecutable, o marcarlas como objetivos pendientes.",
]:
    P(s, NEGRO, bullet=True)

H("7. Observaciones sobre Logros Desbloqueables", 2)
P("Resumen: Logros Desbloqueables es una funcionalidad PARCIAL. El backend desbloquea y persiste "
  "logros al completar un quiz (entidad, enum, motor de reglas, repositorio, evento y prueba unitaria), "
  "pero no existe endpoint, notificacion ni interfaz que permita al usuario verlos. El detalle completo "
  "con referencias de archivos figura en la seccion 'Observaciones y Explicaciones de Auditoria - "
  "Logros Desbloqueables'.", NARANJA)

doc.save(SRC)
print("Secciones finales agregadas. OK")
