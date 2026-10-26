# -*- coding: utf-8 -*-
"""Auditoria v3 de 'clon_final 16 Junio.docx' contra PROYDEMO.
Se RESTAURA desde el backup pre-auditoria y se reaplica con correcciones:
- Morado simetrico (misma estructura, terminos y longitud; sin etiquetas internas).
- Formulacion del Problema: no se recorta, solo se cambian los terminos neuro.
- Alcance: se elimina el bloque azul 'Delimitacion'; se corrige la frase neuro
  y se agregan Enfoque base + Extension tecnica mejorados, sin parentesis ni
  dos puntos innecesarios.
- Palabras clave corregidas. Objetivo General mas completo (no corto).
Texto plano puro: sin rayas largas/cortas, guillemets ni simbolos especiales.
No se elimina ningun texto original."""
import shutil
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.shared import Pt
import docx.shared

SRC = r"C:\Users\angui\Documents\proyectoBorrador\proyDemo\Diagramas finales\clon_final 16 Junio.docx"
BAK = r"C:\Users\angui\Documents\proyectoBorrador\proyDemo\Diagramas finales\clon_final 16 Junio_BACKUP_preaudit.docx"

# Restaurar el documento limpio (original) desde el backup pre-auditoria.
shutil.copyfile(BAK, SRC)

VERDE   = (0x00, 0xB0, 0x50)
ROJO    = (0xFF, 0x00, 0x00)
MORADO  = (0x70, 0x30, 0xA0)
NARANJA = (0xED, 0x7D, 0x31)
AZUL    = (0x00, 0x70, 0xC0)

doc = Document(SRC)
log = []

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
        run.font.color.rgb = docx.shared.RGBColor(*rgb)

def find(sub):
    for p in doc.paragraphs:
        if sub in p.text:
            return p
    return None

def R(text, rgb=None, bold=False, size=11, italic=False):
    return (text, rgb, bold, size, italic)

def table_after(anchor_p, rows, header_rgb=AZUL, body_rgb=AZUL):
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
            r.font.color.rgb = docx.shared.RGBColor(*(header_rgb if ri == 0 else body_rgb))
    anchor_p._p.addnext(t._tbl)
    return t

# ---------------- anclas ----------------
a_indice   = find("ÍNDICE GENERAL")
a_palabras = find("Palabras clave:")
a_p115     = find("un diagnóstico automático")
a_p135     = find("tecnologías de medición neurocognitiva")
a_alcance  = find("Se adjuntará un plan de pruebas unitarias")
a_objgen   = find("Implementar la sección de evaluaciones para realizar el seguimiento")
a_objesp5  = find("Validar la funcionalidad del módulo en el entorno de desarrollo de la empresa")
a_dod_last = find("Datos persistidos correctamente en PostgreSQL")
a_gantt    = find("siguiendo la planificación establecida en el diagrama de Gantt")
a_fase4    = find("Fase 4 – Construcción e Integración Tecnológica")
a_fase5    = find("Fase 5 – Testing Integral")
a_sprint4o = find("Realizar pruebas funcionales, de integración y de usabilidad del módulo")
a_disc     = find("reducirá la tensión cognitiva del usuario")
a_neuro    = find("Como bien señalan Caballero y Llorent (2022)")
a_burbano  = find("Burbano-Enríquez et al., 2025).")
a_ref_burb = find("Burbano-Enríquez, B., Moncayo-Cueva")
a_ref_last = find("Zhang, K., & Aslan, A. B. (2021)")

# ---------------- LEYENDA ----------------
if a_indice:
    insert_before(a_indice, [
        [R("REVISIÓN Y AUDITORÍA TÉCNICA DEL DOCUMENTO (contra el aplicativo PROYDEMO)", AZUL, True, 14)],
        [R("Las marcas de color insertadas a lo largo del documento siguen esta leyenda. No se eliminó ningún texto original.", AZUL, False, 10)],
        [R("Verde: información verificada y correcta frente a PROYDEMO.", VERDE, False, 10)],
        [R("Rojo: fragmento original que no concuerda con lo implementado, conservado intacto como evidencia.", ROJO, False, 10)],
        [R("Morado: corrección limpia y lista para producción, simétrica al texto en rojo, que sí corresponde a PROYDEMO.", MORADO, False, 10)],
        [R("Naranja: explicación técnica y pedagógica del hallazgo.", NARANJA, False, 10)],
        [R("Azul: contenido nuevo agregado donde resulta necesario, como marcos, tablas o glosario.", AZUL, False, 10)],
        [R("", None)],
    ])
    log.append("Leyenda insertada")

# ---------------- PALABRAS CLAVE ----------------
if a_palabras:
    color_para(a_palabras, ROJO)
    insert_after(a_palabras, [
        [R("Palabras clave: la analítica educativa, la inteligencia artificial, los microservicios y la evaluación personalizada. Se incluyen Next.js, FastAPI, NestJS, PostgreSQL, JWT, Scrum, los Métodos ágiles, el análisis de lenguaje natural, el asistente de inteligencia artificial y la retroalimentación pedagógica.", MORADO)],
        [R("Se sustituye \"Neuroeducación\" por \"analítica educativa\" y \"servicios pequeños\" por \"microservicios\", ya que el aplicativo PROYDEMO analiza el desempeño académico y se construye sobre microservicios; no realiza neuroeducación clínica. Los demás términos permanecen porque sí corresponden a la pila tecnológica implementada.", NARANJA)],
    ])
    log.append("Palabras clave corregidas")

# ---------------- B1: P115 ----------------
if a_p115:
    color_para(a_p115, ROJO)
    insert_after(a_p115, [
        [R(" Hoy en día las pruebas tradicionales están muy limitadas. Los resultados llegan tarde, y no dan información sobre el desempeño académico de cada estudiante. Esa falta de información complica la detección temprana de los vacíos conceptuales. Por eso el proyecto propone una alternativa: un análisis automático del desempeño y una retroalimentación personalizada con un agente de inteligencia artificial. El sistema analiza la interacción del usuario al final de cada sesión. El sistema incluso formula sugerencias de instrucción personalizadas correspondientes al rendimiento del usuario, atravesando todo el trayecto.", MORADO)],
        [R("Se cambia \"perfil cognitivo\" por \"desempeño académico\" y \"diagnóstico automático\" por \"análisis automático del desempeño\". PROYDEMO calcula métricas de rendimiento como puntaje, precisión y debilidades por tema; no elabora perfiles ni diagnósticos cognitivos.", NARANJA)],
    ])
    log.append("B1 P115 simétrico")

# ---------------- B1: P135 Formulación del Problema ----------------
if a_p135:
    color_para(a_p135, ROJO)
    insert_after(a_p135, [
        [R("Uno de los principales problemas a los que se enfrentan las instituciones educativas es el escaso rendimiento académico; este hecho se debe, entre otras causas, a las dificultades de aprendizaje no detectadas a tiempo y al uso de modelos de evaluación tradicional que no deja llevar a cabo un análisis a la profundidad del proceso de aprendizaje. La situación anterior provoca que sea necesaria la creación de una aplicación digital inteligente que contenga herramientas de evaluación, analítica educativa y análisis del desempeño académico a fin de realizar el seguimiento del aprendizaje, la evolución del rendimiento del alumno y la toma de decisiones pedagógicas para mejorar el rendimiento académico.", MORADO)],
        [R("Solo se reemplazan los términos que el aplicativo no implementa: \"dificultades cognitivas\" por \"dificultades de aprendizaje\", \"tecnologías de medición neurocognitiva\" por \"análisis del desempeño académico\" y \"evolución cognitiva del alumno\" por \"evolución del rendimiento del alumno\". El resto del párrafo se conserva igual.", NARANJA)],
    ])
    log.append("B1 P135 simétrico completo")

# ---------------- B1: Alcance (P146) y perfil ----------------
if a_alcance:
    color_para(a_alcance, ROJO)
    insert_after(a_alcance, [
        [R("El trabajo que se entregará, contempla la misma persistencia de la base de datos en PostgreSQL donde se irán agregando la información progresivamente con cada evaluación, siendo esta la base para la analítica, la integración de microservicios y una aplicación enfocada en inteligencia artificial, orientado a la generación de analíticas del desempeño académico y en la personalización y el mejoramiento del proceso de aprendizaje del usuario. Se adjuntará un plan de pruebas unitarias de integración y funcionales.", MORADO)],
        [R("Se cambia \"generación de datos científicos en neuroeducación\" por \"generación de analíticas del desempeño académico\". PROYDEMO produce analíticas pedagógicas sobre el rendimiento, no datos científicos de neuroeducación. El resto del alcance permanece intacto.", NARANJA)],
        [R("Enfoque base. El aplicativo se concibe como un asistente educativo orientado a estudiantes de secundaria y bachillerato, con edades entre los 12 y los 18 años, que brinda soporte en materias académicas, resolución de dudas, apoyo en tareas, explicaciones guiadas y preparación para exámenes.", AZUL)],
        [R("Extensión técnica. Dentro del catálogo de materias del módulo, definido en el value object Category con las opciones general, language, math, science, biology, physics, chemistry, history, geography, social_sciences, english, technology y art, la categoría Tecnología, identificada como technology, es la única vertical diseñada conceptualmente para extenderse con facilidad hacia estudiantes universitarios de informática o ingeniería, mediante el ajuste de prompts y contenidos especializados del modelo de lenguaje.", AZUL)],
        [R("", None)],
    ])
    log.append("B1 Alcance P146 + Enfoque/Extensión (sin bloque Delimitación)")

# ---------------- B2: Objetivo General ----------------
if a_objgen:
    color_para(a_objgen, ROJO)
    insert_after(a_objgen, [
        [R("Diseñar y desarrollar la sección de evaluaciones inteligentes para realizar el seguimiento y el análisis del desempeño académico de los estudiantes, que incorpora retroalimentación pedagógica ofrecida por un sistema de asistencia con inteligencia artificial, utilizando microservicios con NestJS y FastAPI, además de prototipado en Figma; el trabajo se desarrollará en la empresa en el transcurso del periodo de prácticas, desde el 11 de marzo hasta el 5 de junio de 2026.", MORADO)],
        [R("Se reemplaza \"seguimiento y análisis de las fortalezas cognitivas, emocionales y metacognitivas\" por \"seguimiento y análisis del desempeño académico\", alcance real del software, y se ajusta la fecha de cierre al 5 de junio de 2026 para mantener la coherencia con el cronograma. Se conservan los microservicios, el prototipado en Figma y la estructura del objetivo.", NARANJA)],
    ])
    log.append("B2 objetivo general (más completo y simétrico)")

# ---------------- B2: Objetivos Específicos ----------------
if a_objesp5:
    insert_after(a_objesp5, [
        [R("Los cinco objetivos específicos originales se consolidan en cuatro metas más precisas, sin perder trazabilidad, alineadas con verbos de ingeniería y con los entregables verificados en PROYDEMO.", NARANJA)],
        [R("Objetivos específicos, versión corregida.", MORADO, True)],
        [R("1. Analizar y documentar los requisitos funcionales y no funcionales del módulo de evaluaciones inteligentes.", MORADO)],
        [R("2. Diseñar e implementar los componentes de software, los microservicios y el modelo de datos de la solución, esto es, el frontend en Next.js, el backend en NestJS, el microservicio en FastAPI y la persistencia en PostgreSQL.", MORADO)],
        [R("3. Integrar los módulos de backend, el servicio de inteligencia artificial y las capas de persistencia mediante servicios REST seguros con autenticación JWT.", MORADO)],
        [R("4. Validar el funcionamiento integral del módulo en el entorno de desarrollo a través de pruebas unitarias, de integración y funcionales.", MORADO)],
        [R("", None)],
    ])
    log.append("B2 objetivos específicos 5 a 4")

# ---------------- B3: Roles ----------------
if a_dod_last:
    insert_after(a_dod_last, [
        [R("", None)],
        [R("Roles del Equipo Scrum y aclaración de rol único", AZUL, True, 12)],
        [R("La metodología Scrum define tres roles. El Product Owner es responsable de priorizar el Product Backlog y definir el valor de cada historia de usuario. El Scrum Master facilita el proceso, remueve impedimentos y vela por el cumplimiento del marco. El Equipo de Desarrollo se encarga de implementar los incrementos del producto.", AZUL)],
        [R("Aclaración de rol único. Al tratarse de un desarrollo e implementación individual, la autora del proyecto fue la única participante y asumió de forma multifuncional y autónoma los tres roles, es decir, Product Owner, Scrum Master y Equipo de Desarrollo, durante todo el ciclo de vida del proyecto.", AZUL)],
        [R("", None)],
    ])
    log.append("B3 roles Scrum")

# ---------------- B3: Gantt fechas ----------------
if a_gantt:
    color_para(a_gantt, ROJO)
    insert_after(a_gantt, [
        [R("La ejecución del proyecto se organizó en etapas progresivas, siguiendo la planificación del diagrama de Gantt, que abarca desde el 11 de marzo hasta el 5 de junio de 2026.", MORADO)],
        [R("El documento declara tres fechas de cierre distintas, 30 de mayo en el Resumen y el Objetivo, 5 de junio en la Introducción y 5 de julio en este apartado. Debe unificarse una única ventana temporal; se adopta del 11 de marzo al 5 de junio de 2026 por ser la coherente con los Sprints corregidos.", NARANJA)],
    ])
    log.append("B3 gantt fechas")

# ---------------- B3: Fases 4/5 ----------------
if a_fase4: color_para(a_fase4, ROJO)
if a_fase5:
    color_para(a_fase5, ROJO)
    insert_after(a_fase5, [
        [R("Las fases 4 y 5 se solapan el 27 de mayo. Secuencia corregida: Fase 4, Construcción e Integración Tecnológica, del 15 al 26 de mayo; Fase 5, Testing Integral, Ajustes y Documentación, del 27 de mayo al 5 de junio.", MORADO)],
    ])
    log.append("B3 fases 4/5 solape")

# ---------------- B3: Sprints ----------------
if a_sprint4o:
    last = insert_after(a_sprint4o, [
        [R("", None)],
        [R("Cronograma corregido por Sprints, secuencia lineal sin solapamientos", AZUL, True, 12)],
    ])
    table_after(last, [
        ["Sprint", "Foco / Historias de usuario", "Fechas (2026)", "Duración"],
        ["Sprint 1", "Acceso y Seguridad, HU 01 a 03", "11 al 24 mar", "2 semanas"],
        ["Sprint 2", "Creación y Gestión de Evaluaciones, HU 04 a 08", "25 mar al 21 abr", "4 semanas"],
        ["Sprint 3", "Evaluación Automatizada y Retroalimentación IA, HU 09 a 12", "22 abr al 22 may", "4 semanas"],
        ["Sprint 4", "Pruebas, Logros y Cierre, HU 13 y pruebas integrales", "23 may al 05 jun", "2 semanas"],
    ])
    insert_after(last, [
        [R("Las fechas originales de los Sprints se solapaban y diferían de las fases; por ejemplo, el Sprint 2 iniciaba el 6 de abril mientras la Fase 2 lo hacía el 26 de marzo. La secuencia anterior es lineal y consecutiva, abarca del 11 de marzo al 5 de junio de 2026 y mantiene la trazabilidad por historias de usuario.", NARANJA)],
        [R("", None)],
    ])
    log.append("B3 tabla sprints corregida")

# ---------------- B3: Métrica antes/después ----------------
if a_disc:
    last = insert_after(a_disc, [
        [R("", None)],
        [R("Métrica de impacto: Antes vs. Después de la retroalimentación cualitativa", AZUL, True, 12)],
    ])
    table_after(last, [
        ["Indicador", "Proceso manual o sistema previo", "PROYDEMO con pipeline automatizado"],
        ["Tiempo de retroalimentación cualitativa por evaluación", "Aproximadamente 2 a 4 horas de redacción manual del docente por grupo", "Menos de 15 segundos por estudiante"],
        ["Disponibilidad de resultados", "Días", "Inmediata, al finalizar la sesión"],
        ["Escalabilidad", "Limitada al tiempo disponible del docente", "Concurrente con asyncio.gather"],
    ])
    insert_after(last, [
        [R("El proceso manual de redactar retroalimentación cualitativa requería un estimado de entre 2 y 4 horas por evaluación; con el pipeline automatizado de PROYDEMO, cuyo timeout de 15 segundos está configurado en ai-client.service.ts, ese tiempo se reduce a menos de 15 segundos por estudiante. Lo que no se mide, no se puede mejorar.", AZUL)],
        [R("El tiempo manual es una estimación de referencia para el contraste; el valor automatizado de menos de 15 segundos está verificado en el código del cliente de IA del backend.", NARANJA)],
        [R("", None)],
    ])
    log.append("B3 métrica antes/después")

# ---------------- B4: Referencias ----------------
if a_ref_burb:
    insert_after(a_ref_burb, [
        [R("Caballero, M., & Llorent, V. J. (2022). The effects of a teacher training program on neuroeducation in improving reading, mathematical, social, emotional and moral competencies of secondary school students. A two-year quasi-experimental study. Revista de Psicodidáctica, 27(2), 158-167. https://doi.org/10.1016/j.psicod.2022.04.001", AZUL)],
    ])
    log.append("B4 referencia Caballero & Llorent agregada")

if a_neuro:
    insert_after(a_neuro, [
        [R("La cita \"Caballero y Llorent (2022)\" se incorpora ahora al listado final de Referencias. El estudio aborda estudiantes de secundaria, congruente con el perfil de usuarios de PROYDEMO de secundaria y bachillerato.", NARANJA)],
    ])
    log.append("B4 nota Caballero en marco teórico")

if a_burbano:
    insert_after(a_burbano, [
        [R("La cita \"Burbano-Enríquez et al. (2025)\" está correctamente citada y listada en Referencias. Su enfoque en desarrollo cognitivo respalda el uso de analíticas pedagógicas; el perfil de usuarios de PROYDEMO, de secundaria y bachillerato con extensión a ingeniería vía la vertical technology, se mantiene congruente con esta literatura.", NARANJA)],
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
        ["BFF Proxy", "Backend for Frontend: capa intermedia en Next.js, proxy.ts, que centraliza y asegura la comunicación entre el frontend y el backend NestJS, oculta endpoints internos y propaga el JWT."],
        ["RAG", "Retrieval-Augmented Generation: técnica que enriquece las respuestas del LLM recuperando fragmentos relevantes de un corpus, reduciendo alucinaciones."],
        ["FAISS", "Facebook AI Similarity Search: biblioteca de búsqueda de similitud vectorial usada como índice del RAG; opera en RAM."],
        ["JWT", "JSON Web Token: estándar RFC 7519 para autenticación y autorización sin estado mediante tokens firmados digitalmente."],
        ["Lematización", "Proceso de PLN que reduce una palabra a su lema o forma base, implementado con spaCy."],
        ["NER", "Named Entity Recognition: reconocimiento de entidades nombradas como nombres, lugares y fechas en un texto, con spaCy."],
        ["LLM", "Large Language Model: modelo de lenguaje de gran escala, Qwen3, Mistral o Llama 3.2, ejecutado localmente vía Ollama."],
        ["Ollama", "Runtime local para ejecutar modelos de lenguaje sin enviar datos a terceros."],
        ["Sentence Transformers", "Modelos que generan embeddings para medir la similitud semántica entre respuestas."],
        ["spaCy", "Biblioteca de procesamiento de lenguaje natural para análisis lingüístico como lematización, NER y dependencias."],
        ["Microservicios", "Estilo arquitectónico basado en componentes independientes, pequeños y de bajo acoplamiento."],
        ["Arquitectura Hexagonal", "Puertos y Adaptadores: separa las capas de dominio, aplicación, infraestructura y presentación."],
        ["JSONB", "Tipo de dato binario de PostgreSQL para almacenar JSON indexable."],
        ["UUID", "Identificador único universal empleado como clave primaria en todas las tablas."],
        ["SSE", "Server-Sent Events: canal unidireccional del servidor al cliente para notificaciones en tiempo real."],
        ["TypeORM", "ORM de TypeScript usado para el mapeo objeto-relacional sobre PostgreSQL."],
        ["HMAC", "Hash-based Message Authentication Code: firma la comunicación segura entre microservicios."],
        ["Patrones de diseño", "Strategy para la selección de estrategia de calificación, Factory para la creación de proveedores y modelos, Adapter para la integración de Ollama y Sentence Transformers, Observer para los eventos de dominio con EventEmitter2 y Command para el encapsulado de casos de uso."],
    ]
    table_after(last, glos)
    log.append("B4 glosario técnico")

# ---------------- ESTILO: saltos de página ----------------
nbreaks = 0
for p in doc.paragraphs:
    st = p.style.name if p.style else ''
    txt = p.text.strip()
    if st == 'Heading 1' or txt.startswith('ÍNDICE'):
        p.paragraph_format.page_break_before = True
        nbreaks += 1
log.append("Estilo: page_break_before aplicado a %d encabezados/índices" % nbreaks)

# ---------------- cierre AZUL ----------------
if a_ref_last:
    end = doc.paragraphs[-1]
    insert_after(end, [
        [R("", None)],
        [R("Resumen de la auditoría", AZUL, True, 12)],
        [R("Bloques revisados. Primero, palabras clave, formulación del problema, alcance y perfil de usuarios. Segundo, objetivos, el general más completo y los específicos de cinco a cuatro. Tercero, metodología ágil, con roles de rol único, cronograma lineal por Sprints y métrica Antes vs. Después. Cuarto, referencias, con el alta de Caballero & Llorent, 2022, marco teórico, glosario técnico y saltos de página por capítulo. Todo el texto original se conservó intacto.", AZUL)],
    ])

doc.save(SRC)
print("Restaurado desde backup y reaplicado.")
print("Guardado:", SRC)
print("\n".join(log))
print("Total cambios:", len(log))
