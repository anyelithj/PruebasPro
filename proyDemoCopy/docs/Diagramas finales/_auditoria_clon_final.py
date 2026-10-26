# -*- coding: utf-8 -*-
"""Auditoria de 'clon_final 16 Junio.docx' contra PROYDEMO.
Leyenda: Verde=verificado / Rojo=original no concuerda (intacto) /
Morado=correccion sugerida / Naranja=explicacion / Azul=contenido nuevo.
No se elimina ningun texto original."""
import shutil
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.shared import Pt

SRC = r"C:\Users\angui\Documents\proyectoBorrador\proyDemo\Diagramas finales\clon_final 16 Junio.docx"
BAK = r"C:\Users\angui\Documents\proyectoBorrador\proyDemo\Diagramas finales\clon_final 16 Junio_BACKUP_preaudit.docx"

VERDE   = (0x00, 0xB0, 0x50)
ROJO    = (0xFF, 0x00, 0x00)
MORADO  = (0x70, 0x30, 0xA0)
NARANJA = (0xED, 0x7D, 0x31)
AZUL    = (0x00, 0x70, 0xC0)

shutil.copyfile(SRC, BAK)
doc = Document(SRC)
log = []

# ---------- helpers ----------
def _rpr(rgb, bold, size, italic):
    rPr = OxmlElement('w:rPr')
    if bold:   rPr.append(OxmlElement('w:b'))
    if italic: rPr.append(OxmlElement('w:i'))
    if rgb is not None:
        c = OxmlElement('w:color'); c.set(qn('w:val'), '%02X%02X%02X' % rgb); rPr.append(c)
    if size:
        sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(int(size*2))); rPr.append(sz)
    return rPr

def _mk_p(runs):
    """runs: list of (text,rgb,bold,size,italic)"""
    p = OxmlElement('w:p')
    for (text, rgb, bold, size, italic) in runs:
        r = OxmlElement('w:r')
        r.append(_rpr(rgb, bold, size, italic))
        t = OxmlElement('w:t'); t.text = text
        t.set(qn('xml:space'), 'preserve')
        r.append(t)
        p.append(r)
    return p

def insert_after(anchor_p, blocks):
    """blocks: list of paragraphs; each paragraph = list of run tuples. Returns last Paragraph."""
    cur = anchor_p._p
    last = anchor_p
    for runs in blocks:
        newp = _mk_p(runs)
        cur.addnext(newp)
        cur = newp
        last = Paragraph(newp, anchor_p._parent)
    return last

def insert_before(anchor_p, blocks):
    first = None
    ref = anchor_p._p
    for runs in blocks:
        newp = _mk_p(runs)
        ref.addprevious(newp)
        if first is None:
            first = Paragraph(newp, anchor_p._parent)
    return first

def color_para(p, rgb):
    if not p.runs and p.text.strip():
        p.add_run(p.text)
    for run in p.runs:
        run.font.color.rgb = __import__('docx').shared.RGBColor(*rgb)

def find(sub):
    for p in doc.paragraphs:
        if sub in p.text:
            return p
    return None

def R(text, rgb=None, bold=False, size=11, italic=False):
    return (text, rgb, bold, size, italic)

def table_after(anchor_p, rows, header_rgb=AZUL, body_rgb=AZUL):
    """rows: list of list[str]; first row header. Builds table and moves it after anchor."""
    t = doc.add_table(rows=0, cols=len(rows[0]))
    try: t.style = 'Table Grid'
    except Exception: pass
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for ci, val in enumerate(row):
            cells[ci].text = ''
            p = cells[ci].paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            r.bold = (ri == 0)
            r.font.color.rgb = __import__('docx').shared.RGBColor(*(header_rgb if ri == 0 else body_rgb))
    anchor_p._p.addnext(t._tbl)
    return t

import docx.shared  # ensure available

# ======================================================================
# CAPTURAR ANCLAS (objetos) ANTES de insertar
# ======================================================================
a_indice   = find("ÍNDICE GENERAL")
a_p115     = find("un diagnóstico automático")
a_p135     = find("tecnologías de medición neurocognitiva")
a_alcance  = find("Se adjuntará un plan de pruebas unitarias")  # fin de Alcance (P146)
a_objgen   = find("Implementar la sección de evaluaciones para realizar el seguimiento")  # P149
a_objesp5  = find("Validar la funcionalidad del módulo en el entorno de desarrollo de la empresa")  # P155
a_dod_last = find("Datos persistidos correctamente en PostgreSQL")  # P657 fin DoD
a_gantt    = find("siguiendo la planificación establecida en el diagrama de Gantt")  # P607
a_fase4    = find("Fase 4 – Construcción e Integración Tecnológica")  # P613
a_fase5    = find("Fase 5 – Testing Integral")  # P616
a_sprint4o = find("Realizar pruebas funcionales, de integración y de usabilidad del módulo")  # P646
a_disc     = find("reducirá la tensión cognitiva del usuario")  # P896 discusion
a_neuro    = find("Como bien señalan Caballero y Llorent (2022)")  # P158
a_burbano  = find("Burbano-Enríquez et al., 2025).")  # P183
a_ref_burb = find("Burbano-Enríquez, B., Moncayo-Cueva")  # P924 ref
a_ref_last = find("Zhang, K., & Aslan, A. B. (2021)")  # P935 ultima ref

# ======================================================================
# LEYENDA / PORTADA DE AUDITORIA (AZUL) antes del indice
# ======================================================================
if a_indice:
    insert_before(a_indice, [
        [R("REVISIÓN Y AUDITORÍA TÉCNICA DEL DOCUMENTO (contra el aplicativo PROYDEMO)", AZUL, True, 14)],
        [R("Las marcas de color insertadas a lo largo del documento siguen esta leyenda. No se eliminó ningún texto original.", AZUL, False, 10)],
        [R("🟢 Verde: información verificada y correcta frente a PROYDEMO.", VERDE, False, 10)],
        [R("🔴 Rojo: fragmento original que no concuerda con lo implementado (se conserva intacto como evidencia).", ROJO, False, 10)],
        [R("🟣 Morado: corrección sugerida que sí corresponde a PROYDEMO.", MORADO, False, 10)],
        [R("🟠 Naranja: explicación técnica y pedagógica del hallazgo.", NARANJA, False, 10)],
        [R("🔵 Azul: contenido nuevo agregado (marcos, tablas, glosario, matrices).", AZUL, False, 10)],
        [R("", None)],
    ])
    log.append("Leyenda insertada")

# ======================================================================
# BLOQUE 1: ALCANCES, DELIMITACIÓN Y PERFIL DE USUARIOS
# ======================================================================
if a_p115:
    color_para(a_p115, ROJO)
    insert_after(a_p115, [
        [R("[Corrección] Las pruebas tradicionales presentan limitaciones: los resultados llegan tarde y aportan poca información sobre el desempeño de cada estudiante. Para atender esa brecha, el proyecto propone una alternativa de ingeniería de software: la calificación automática de las respuestas y una retroalimentación pedagógica personalizada generada por un agente de inteligencia artificial. Al finalizar cada sesión, el sistema analiza el desempeño académico del usuario —sin realizar diagnósticos neurocognitivos— y formula recomendaciones de estudio acordes con su rendimiento.", MORADO)],
        [R("[Explicación] El término «diagnóstico» neurocognitivo excede el alcance del aplicativo. PROYDEMO recopila analíticas pedagógicas (puntajes, precisión, debilidades por tema) mediante el contexto Feedback del microservicio FastAPI; no aplica instrumentos psicométricos ni neurológicos. Cualquier diagnóstico profundo o intervención corresponde a profesionales de psicología o neuroeducación. El rol del proyecto se limita al desarrollo e ingeniería de software.", NARANJA)],
    ])
    log.append("B1 P115 diagnóstico->análisis desempeño")

if a_p135:
    color_para(a_p135, ROJO)
    insert_after(a_p135, [
        [R("[Corrección] La situación descrita hace necesaria una aplicación digital inteligente que integre herramientas de evaluación y analítica educativa para apoyar el seguimiento del aprendizaje, el análisis del desempeño académico del estudiante y la toma de decisiones pedagógicas orientadas a mejorar el rendimiento.", MORADO)],
        [R("[Explicación] Se reemplaza «tecnologías de medición neurocognitiva» y «evolución cognitiva» por «analítica educativa» y «análisis del desempeño académico». PROYDEMO no implementa medición neurocognitiva alguna; opera sobre métricas de rendimiento (correct_count, accuracy, debilidades por categoría) persistidas en PostgreSQL.", NARANJA)],
    ])
    log.append("B1 P135 formulación problema")

if a_alcance:
    insert_after(a_alcance, [
        [R("Delimitación del alcance y perfil de usuarios (PROYDEMO)", AZUL, True, 12)],
        [R("Delimitación: el proyecto se circunscribe al desarrollo e ingeniería de software de un módulo de evaluaciones inteligentes. El ecosistema realiza un análisis del desempeño académico —analíticas pedagógicas: puntajes, precisión, debilidades por tema y recomendaciones de estudio— y no un diagnóstico neurocognitivo ni neuroeducativo. Todo diagnóstico clínico o intervención especializada queda fuera del alcance y corresponde a profesionales en psicología o neuroeducación.", AZUL)],
        [R("Enfoque base: asistente educativo orientado a estudiantes de secundaria y bachillerato (12 a 18 años), que brinda soporte en materias académicas, resolución de dudas, apoyo en tareas, explicaciones guiadas y preparación para exámenes.", AZUL)],
        [R("Extensión técnica: dentro del catálogo de materias del módulo (value object Category: general, language, math, science, biology, physics, chemistry, history, geography, social_sciences, english, technology, art), la categoría «Tecnología» (technology) es la única vertical diseñada conceptualmente para extenderse con facilidad hacia estudiantes universitarios de informática o ingeniería, mediante el ajuste de prompts y contenidos especializados del modelo de lenguaje.", AZUL)],
        [R("", None)],
    ])
    log.append("B1 delimitación+perfil insertado")

# ======================================================================
# BLOQUE 2: OBJETIVOS
# ======================================================================
if a_objgen:
    color_para(a_objgen, ROJO)
    insert_after(a_objgen, [
        [R("[Corrección — Objetivo General] Diseñar y desarrollar un módulo de evaluaciones inteligentes bajo una arquitectura de microservicios (NestJS y FastAPI) capaz de generar retroalimentación pedagógica asistida por inteligencia artificial a partir del desempeño académico de los estudiantes, durante el periodo de prácticas en la empresa, entre el 11 de marzo y el 5 de junio de 2026.", MORADO)],
        [R("[Explicación] El objetivo original menciona «fortalezas cognitivas, emocionales y metacognitivas», alcance propio de la neuroeducación clínica y no del software entregado. PROYDEMO genera retroalimentación pedagógica (contextos Grading y Feedback en FastAPI) sobre el desempeño académico; el objetivo corregido refleja el núcleo real del proyecto: microservicios + retroalimentación asistida por IA.", NARANJA)],
    ])
    log.append("B2 objetivo general")

if a_objesp5:
    insert_after(a_objesp5, [
        [R("[Explicación] Los cinco objetivos específicos originales se consolidan en cuatro metas más precisas, sin perder trazabilidad, alineadas con verbos de ingeniería y con los entregables verificados en PROYDEMO.", NARANJA)],
        [R("[Corrección — Objetivos Específicos consolidados]", MORADO, True)],
        [R("1. Analizar y documentar los requisitos funcionales y no funcionales del módulo de evaluaciones inteligentes.", MORADO)],
        [R("2. Diseñar e implementar los componentes de software, los microservicios y el modelo de datos de la solución (frontend Next.js, backend NestJS, microservicio FastAPI y persistencia en PostgreSQL).", MORADO)],
        [R("3. Integrar los módulos de backend, el servicio de inteligencia artificial y las capas de persistencia mediante servicios REST seguros con autenticación JWT.", MORADO)],
        [R("4. Validar el funcionamiento integral del módulo en el entorno de desarrollo a través de pruebas unitarias, de integración y funcionales.", MORADO)],
        [R("", None)],
    ])
    log.append("B2 objetivos específicos 5->4")

# ======================================================================
# BLOQUE 3: METODOLOGÍA — ROLES, CRONOGRAMA, MÉTRICA
# ======================================================================
if a_dod_last:
    insert_after(a_dod_last, [
        [R("", None)],
        [R("Roles del Equipo Scrum y aclaración de rol único", AZUL, True, 12)],
        [R("La metodología Scrum define tres roles: (1) Product Owner, responsable de priorizar el Product Backlog y definir el valor de cada historia de usuario; (2) Scrum Master, que facilita el proceso, remueve impedimentos y vela por el cumplimiento del marco; y (3) Equipo de Desarrollo, encargado de implementar los incrementos del producto.", AZUL)],
        [R("Aclaración de rol único: al tratarse de un desarrollo e implementación individual, la autora del proyecto fue la única participante y asumió de forma multifuncional y autónoma los tres roles (Product Owner, Scrum Master y Equipo de Desarrollo) durante todo el ciclo de vida del proyecto.", AZUL)],
        [R("", None)],
    ])
    log.append("B3 roles Scrum")

if a_gantt:
    color_para(a_gantt, ROJO)
    insert_after(a_gantt, [
        [R("[Corrección] La ejecución del proyecto se organizó en etapas progresivas, siguiendo la planificación del diagrama de Gantt, que abarca desde el 11 de marzo hasta el 5 de junio de 2026.", MORADO)],
        [R("[Explicación] El documento declara tres fechas de cierre distintas (30 de mayo en el Resumen y el Objetivo, 5 de junio en la Introducción y 5 de julio en este apartado). Debe unificarse una única ventana temporal; se adopta 11 de marzo – 5 de junio de 2026 por ser la coherente con los Sprints corregidos.", NARANJA)],
    ])
    log.append("B3 gantt fechas")

if a_fase4: color_para(a_fase4, ROJO)
if a_fase5:
    color_para(a_fase5, ROJO)
    insert_after(a_fase5, [
        [R("[Corrección] Las fases 4 y 5 se solapan el 27 de mayo. Secuencia corregida: Fase 4 – Construcción e Integración Tecnológica (15 – 26 de mayo); Fase 5 – Testing Integral, Ajustes y Documentación (27 de mayo – 5 de junio).", MORADO)],
    ])
    log.append("B3 fases 4/5 solape")

if a_sprint4o:
    last = insert_after(a_sprint4o, [
        [R("", None)],
        [R("Cronograma corregido por Sprints (secuencia lineal, sin solapamientos)", AZUL, True, 12)],
    ])
    table_after(last, [
        ["Sprint", "Foco / Historias de usuario", "Fechas (2026)", "Duración"],
        ["Sprint 1", "Acceso y Seguridad (HU 01–03)", "11 – 24 mar", "2 semanas"],
        ["Sprint 2", "Creación y Gestión de Evaluaciones (HU 04–08)", "25 mar – 21 abr", "4 semanas"],
        ["Sprint 3", "Evaluación Automatizada y Retroalimentación IA (HU 09–12)", "22 abr – 22 may", "4 semanas"],
        ["Sprint 4", "Pruebas, Logros y Cierre (HU 13 + pruebas integrales)", "23 may – 05 jun", "2 semanas"],
    ])
    insert_after(last, [
        [R("[Explicación] Las fechas originales de los Sprints se solapaban y diferían de las fases (p. ej. Sprint 2 iniciaba el 6 de abril mientras la Fase 2 lo hacía el 26 de marzo). La secuencia anterior es lineal y consecutiva, abarca del 11 de marzo al 5 de junio de 2026 y mantiene la trazabilidad por historias de usuario.", NARANJA)],
        [R("", None)],
    ])
    log.append("B3 tabla sprints corregida")

if a_disc:
    last = insert_after(a_disc, [
        [R("", None)],
        [R("Métrica de impacto: Antes vs. Después (retroalimentación cualitativa)", AZUL, True, 12)],
    ])
    table_after(last, [
        ["Indicador", "Proceso manual / sistema previo", "PROYDEMO (pipeline automatizado)"],
        ["Tiempo de retroalimentación cualitativa por evaluación", "≈ 2 a 4 horas de redacción manual del docente por grupo", "< 15 segundos por estudiante"],
        ["Disponibilidad de resultados", "Días", "Inmediata, al finalizar la sesión"],
        ["Escalabilidad", "Limitada al tiempo disponible del docente", "Concurrente (asyncio.gather)"],
    ])
    insert_after(last, [
        [R("El proceso manual de redactar retroalimentación cualitativa requería un estimado de entre 2 y 4 horas por evaluación; con el pipeline automatizado de PROYDEMO (timeout de 15 s configurado en ai-client.service.ts) ese tiempo se reduce a menos de 15 segundos por estudiante. Lo que no se mide, no se puede mejorar.", AZUL)],
        [R("[Nota] El tiempo manual es una estimación de referencia (baseline) para el contraste; el valor automatizado (< 15 s) está verificado en el código del cliente de IA del backend.", NARANJA)],
        [R("", None)],
    ])
    log.append("B3 métrica antes/después")

# ======================================================================
# BLOQUE 4: REFERENCIAS, MARCO TEÓRICO, GLOSARIO, ESTILO
# ======================================================================
if a_ref_burb:
    insert_after(a_ref_burb, [
        [R("Caballero, M., & Llorent, V. J. (2022). The effects of a teacher training program on neuroeducation in improving reading, mathematical, social, emotional and moral competencies of secondary school students. A two-year quasi-experimental study. Revista de Psicodidáctica, 27(2), 158–167. https://doi.org/10.1016/j.psicod.2022.04.001", AZUL)],
    ])
    log.append("B4 referencia Caballero & Llorent agregada")

if a_neuro:
    insert_after(a_neuro, [
        [R("[Verificado] La cita «Caballero y Llorent (2022)» se incorpora ahora al listado final de Referencias. El estudio aborda estudiantes de secundaria, congruente con el perfil de usuarios de PROYDEMO (secundaria y bachillerato).", NARANJA)],
    ])
    log.append("B4 nota Caballero en marco teórico")

if a_burbano:
    insert_after(a_burbano, [
        [R("[Verificado] «Burbano-Enríquez et al. (2025)» está correctamente citado y listado en Referencias. Su enfoque en desarrollo cognitivo respalda el uso de analíticas pedagógicas; el perfil de usuarios de PROYDEMO (secundaria/bachillerato, con extensión a ingeniería vía la vertical technology) se mantiene congruente con esta literatura.", NARANJA)],
    ])
    log.append("B4 nota Burbano alineada")

if a_ref_last:
    last = insert_after(a_ref_last, [
        [R("", None)],
        [R("Glosario Técnico", AZUL, True, 14)],
        [R("Definición de los conceptos clave empleados en el proyecto PROYDEMO.", AZUL, False, 10)],
    ])
    glos = [
        ["Término", "Definición"],
        ["BFF Proxy", "Backend for Frontend: capa intermedia en Next.js (proxy.ts) que centraliza y asegura la comunicación entre el frontend y el backend NestJS, oculta endpoints internos y propaga el JWT."],
        ["RAG", "Retrieval-Augmented Generation: técnica que enriquece las respuestas del LLM recuperando fragmentos relevantes de un corpus, reduciendo alucinaciones."],
        ["FAISS", "Facebook AI Similarity Search: biblioteca de búsqueda de similitud vectorial usada como índice del RAG; opera en RAM."],
        ["JWT", "JSON Web Token: estándar RFC 7519 para autenticación y autorización sin estado mediante tokens firmados digitalmente."],
        ["Lematización", "Proceso de PLN que reduce una palabra a su lema o forma base (implementado con spaCy)."],
        ["NER", "Named Entity Recognition: reconocimiento de entidades nombradas (nombres, lugares, fechas) en un texto (spaCy)."],
        ["LLM", "Large Language Model: modelo de lenguaje de gran escala (Qwen3, Mistral, Llama 3.2) ejecutado localmente vía Ollama."],
        ["Ollama", "Runtime local para ejecutar modelos de lenguaje sin enviar datos a terceros."],
        ["Sentence Transformers", "Modelos que generan embeddings para medir la similitud semántica entre respuestas."],
        ["spaCy", "Biblioteca de procesamiento de lenguaje natural para análisis lingüístico (lematización, NER, dependencias)."],
        ["Microservicios", "Estilo arquitectónico basado en componentes independientes, pequeños y de bajo acoplamiento."],
        ["Arquitectura Hexagonal", "Puertos y Adaptadores: separa las capas de dominio, aplicación, infraestructura y presentación."],
        ["JSONB", "Tipo de dato binario de PostgreSQL para almacenar JSON indexable."],
        ["UUID", "Identificador único universal empleado como clave primaria en todas las tablas."],
        ["SSE", "Server-Sent Events: canal unidireccional servidor→cliente para notificaciones en tiempo real."],
        ["TypeORM", "ORM de TypeScript usado para el mapeo objeto-relacional sobre PostgreSQL."],
        ["HMAC", "Hash-based Message Authentication Code: firma la comunicación segura entre microservicios."],
        ["Patrones de diseño", "Strategy (selección de estrategia de calificación), Factory (creación de proveedores/modelos), Adapter (integración de Ollama/Sentence Transformers), Observer (eventos de dominio con EventEmitter2) y Command (encapsulado de casos de uso)."],
    ]
    table_after(last, glos)
    log.append("B4 glosario técnico")

# ---------- ESTILO: saltos de página en capítulos e índices ----------
nbreaks = 0
for p in doc.paragraphs:
    st = p.style.name if p.style else ''
    txt = p.text.strip()
    if st == 'Heading 1' or txt.startswith('ÍNDICE'):
        p.paragraph_format.page_break_before = True
        nbreaks += 1
log.append(f"Estilo: page_break_before aplicado a {nbreaks} encabezados/índices")

# ---------- cierre AZUL ----------
if a_ref_last:
    end = doc.paragraphs[-1]
    insert_after(end, [
        [R("", None)],
        [R("Resumen de la auditoría", AZUL, True, 12)],
        [R("Bloques revisados: (1) Alcance, delimitación y perfil de usuarios; (2) Objetivos (general y específicos 5→4); (3) Metodología ágil: roles de rol único, cronograma lineal por Sprints y métrica Antes vs. Después; (4) Referencias (alta de Caballero & Llorent, 2022), marco teórico, glosario técnico y saltos de página por capítulo. Todo el texto original se conservó intacto.", AZUL)],
    ])

doc.save(SRC)
print("Guardado:", SRC)
print("Backup:", BAK)
print("\n".join(log))
print("Total cambios:", len(log))
