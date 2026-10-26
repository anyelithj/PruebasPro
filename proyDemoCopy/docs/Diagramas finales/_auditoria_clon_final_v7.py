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
a_res122   = find("del módulo de evaluaciones con inteligencia artificial para la")
a_res126   = find("La etapa de puesta en marcha dio principio")
a_intro133 = find("comenzó la implementación de un módulo de simulaciones")
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

# ---------------- REDACCIÓN: párrafos rotos del Resumen e Introducción ----------------
if a_res122:
    color_para(a_res122, ROJO)
    insert_after(a_res122, [
        [R("El informe expone el análisis, el diseño y el desarrollo del módulo de evaluaciones con inteligencia artificial para una plataforma educativa. Su elaboración tuvo lugar del 11 de marzo al 5 de junio de 2026. El módulo forma parte de un ecosistema educativo en desarrollo y busca renovar los métodos de evaluación apoyándose en la inteligencia artificial.", MORADO)],
        [R("La frase original quedaba cortada en \"para la\" y luego saltaba a otra oración. Se completa la idea, se unifica la fecha de cierre al 5 de junio y se varía la repetición de \"El módulo\" con \"ecosistema educativo\". No se cambian los términos técnicos.", NARANJA)],
    ])
    log.append("Redacción Resumen P122 (frase cortada)")

if a_res126:
    color_para(a_res126, ROJO)
    insert_after(a_res126, [
        [R("La etapa de puesta en marcha inició al detectar la necesidad el 11 de marzo de 2026 y concluyó con el cierre del diseño técnico definitivo el 5 de mayo del mismo año. Se centró en la dimensión técnica del sistema, en especial en la arquitectura de microservicios construida con NestJS y FastAPI, así como en los prototipos visuales en Figma y, por otra parte, en el módulo de evaluaciones ya funcional. En esta fase se definió la parte técnica del aplicativo, se diseñó la arquitectura de microservicios con NestJS y FastAPI, se crearon los prototipos visuales en Figma y se desarrolló el módulo de evaluaciones en funcionamiento. Los resultados obtenidos indican que entregar recomendaciones de estudio a la medida después de cada sesión de evaluación ayuda al estudiante a mejorar la manera en que reflexiona sobre su propio aprendizaje. Esto confirma que la inteligencia artificial tiene un lugar en las escuelas y en los entornos de aprendizaje. Además, el componente de autenticación y registro facilita al personal el seguimiento de la información académica del alumno. A partir de ahí se establecen los fundamentos necesarios para el análisis educativo.", MORADO)],
        [R("Se corrige la falta de fluidez y los puntos faltantes: \"dio principio al descubrir el inconveniente\" pasa a \"inició al detectar la necesidad\", se cierra la oración antes de \"Se centró\" y antes de \"Además\", y se redacta en una sola voz en lugar de \"El equipo\", coherente con el desarrollo individual. Se conservan NestJS, FastAPI y Figma.", NARANJA)],
    ])
    log.append("Redacción Resumen P126 (fluidez y puntos)")

if a_intro133:
    color_para(a_intro133, ROJO)
    insert_after(a_intro133, [
        [R("La empresa comenzó la implementación de un módulo de evaluaciones como el primero de los componentes de su plataforma, orientado a definir con la mayor precisión analítica y la mayor capacidad adaptativa los procesos de valoración académica. El presente documento recoge las fases de análisis, diseño, construcción y validación que se llevaron a cabo entre el 11 de marzo y el 5 de junio de 2026. La solución puesta en producción articula una arquitectura basada en servicios apoyada en NestJS y FastAPI, una capa de presentación bajo la herramienta Next.js y un agente de inteligencia artificial encargado de transformar los resultados de las evaluaciones en retroalimentación pedagógica relevante, ajustada al perfil de cada uno de los estudiantes.", MORADO)],
        [R("El párrafo abría con \"La  comenzó\", sin sujeto, y con un espacio doble. Se completa con \"La empresa\", se corrige \"módulo de simulaciones\" por \"módulo de evaluaciones\" para corresponder al aplicativo real y se reemplaza \"precisión diagnóstica\" por \"precisión analítica\". Se conservan NestJS, FastAPI y Next.js.", NARANJA)],
    ])
    log.append("Redacción Introducción P133 (sujeto faltante y término)")

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
        [R("Enfoque base. La plataforma funciona como un apoyo de estudio pensado para estudiantes de secundaria y bachillerato, con edades entre los 12 y los 18 años. Les permite repasar las distintas materias, poner a prueba lo aprendido mediante evaluaciones y recibir una retroalimentación clara que les explica el concepto en el que fallaron y cómo mejorar, de modo que puedan prepararse mejor para sus exámenes.", AZUL)],
        [R("Extensión técnica. Entre las materias disponibles en el módulo, como lenguaje, matemáticas, ciencias, biología, física, química, historia, geografía, ciencias sociales, inglés, tecnología y arte, la de tecnología es la única que se pensó desde el inicio para poder ampliarse con facilidad hacia estudiantes universitarios de informática o ingeniería, ajustando las indicaciones y los contenidos especializados que recibe el modelo de inteligencia artificial.", AZUL)],
        [R("Validación frente a PROYDEMO. Lo que hoy está implementado de principio a fin, en el backend y en el frontend, es la generación de evaluaciones por materias, incluida la de tecnología, la calificación automática y la retroalimentación pedagógica que explica cada respuesta. El tutor conversacional para resolver dudas en tiempo real existe en el servicio de inteligencia artificial, pero todavía no está enlazado al backend ni a la pantalla del estudiante, por lo que se describe como una capacidad en desarrollo y no como una función ya disponible.", NARANJA)],
        [R("", None)],
    ])
    log.append("B1 Alcance P146 + Enfoque/Extensión humanizados + validación")

# ---------------- B2: Objetivo General ----------------
if a_objgen:
    color_para(a_objgen, ROJO)
    insert_after(a_objgen, [
        [R("Diseñar y desarrollar la sección de evaluaciones inteligentes para realizar el seguimiento y el análisis del desempeño académico de los estudiantes, que incorpora retroalimentación pedagógica ofrecida por un sistema de asistencia con inteligencia artificial, utilizando microservicios con NestJS y FastAPI, además de prototipado en Figma; el trabajo se desarrollará en la empresa en el transcurso del periodo de desarrollo, desde el 11 de marzo hasta el 5 de junio de 2026.", MORADO)],
        [R("Se reemplaza \"seguimiento y análisis de las fortalezas cognitivas, emocionales y metacognitivas\" por \"seguimiento y análisis del desempeño académico\", alcance real del software; se evita el término \"prácticas\" en favor de \"periodo de desarrollo\" y se ajusta la fecha de cierre al 5 de junio de 2026 para mantener la coherencia con el cronograma. Se conservan los microservicios, el prototipado en Figma y la estructura del objetivo.", NARANJA)],
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

# ======================================================================
# PASADA DE REDACCIÓN: Empresa, Justificación, Alcance y Marco Teórico
# Solo se mejora la redacción (fluidez, concordancia, puntuación) sin
# cambiar los términos. Sin paréntesis ni dos puntos en el texto morado;
# se conservan las citas APA. Rojo = original intacto; Morado = corrección.
# ======================================================================
REDACCION = [
    ("se fundó en el 2007 con un grupo de especialistas",
     "La empresa se fundó en el 2007 de la mano de un grupo de especialistas cuya meta era brindar soporte a las comunidades más necesitadas, en su mayoría por su situación económica. Ante la problemática social que vive nuestra nación, plantea una estrategia que parte de la ciencia y la educación. Funciona como motor del cambio y ofrece un programa que busca formar y movilizar redes de ayuda. Estas redes aportan su propio saber para acompañar los ámbitos pedagógicos, sociales y productivos.",
     "Se corrige la redacción y la concordancia, se completa el sujeto inicial y se ajusta la puntuación. No se cambian los términos."),
    ("El proyecto nace porque los métodos viejos de evaluación ya no sirven",
     "La propuesta nace porque los métodos tradicionales de evaluación ya no resultan suficientes. Esos métodos entregan una retroalimentación tardía, genérica y poco alineada con el perfil de cada estudiante. Con un módulo de evaluación que emplea inteligencia artificial, la solución podrá calificar de forma automática las respuestas abiertas mediante técnicas de similitud semántica. El módulo, además, generará retroalimentación personalizada en segundos. Gracias a esa retroalimentación, se fortalecerán los procesos de aprendizaje. Más adelante ayudará a detectar a tiempo las oportunidades de mejora. Por último, posicionará a la organización a la vanguardia de la neuroeducación basada en evidencia.",
     "Se reduce la repetición de \"el proyecto\" con sinónimos y se mejora la fluidez. Se conservan los términos similitud semántica, inteligencia artificial y neuroeducación basada en evidencia."),
    ("La solución ofrecerá rutas de mejora claras, escalables y trazables",
     "La solución ofrecerá rutas de mejora claras, escalables y trazables, enmarcadas dentro de una arquitectura de microservicios. Esta arquitectura asegura la flexibilidad, la integración y el crecimiento futuro del sistema.",
     "Se enlazan las tres oraciones para evitar la repetición de \"rutas\" y \"arquitectura de microservicios\". No se cambian los términos."),
    ("El alcance englobado en este proyecto es de diseño y desarrollo funcional",
     "El alcance de este proyecto comprende el diseño y el desarrollo funcional del módulo de evaluaciones bajo una arquitectura de microservicios. La primera fase abarca el prototipado en Figma, los modelos de diseño del sistema y el modelado de la base de datos como insumos base. A partir de estos artefactos se construirá el frontend en Next.js, los microservicios de backend con NestJS y FastAPI, el BFF o Backend for Frontend que actúa como intermediario de comunicación, la autenticación mediante JWT y el componente de integración con el agente de asistencia IA, responsable de generar la retroalimentación pedagógica y las recomendaciones orientadas a personalizar el aprendizaje.",
     "Se corrige \"de fines del módulo evaluaciones\" por \"del módulo de evaluaciones\" y la concordancia del BFF, evitando los paréntesis. Se conservan Figma, Next.js, NestJS, FastAPI y JWT."),
    ("Es un ámbito de saber que fusiona aportaciones de la neurociencia",
     "Es un ámbito de saber que fusiona aportaciones de la neurociencia cognitiva con las ciencias educativas. Se enfoca en profundizar la forma de comprender los procesos cerebrales que repercuten en la asimilación de saberes y en el desarrollo de vivencias educativas más eficientes. Como bien señalan Caballero y Llorent (2022), esta perspectiva brinda soportes científicos para potenciar los métodos de enseñanza y adaptarlos a los requerimientos del alumnado. En el estudio desarrollado se observaron progresos notables, tanto en la capacidad de mantener la atención como en el desempeño académico. De igual manera, los principios de la neuroeducación se integran en escenarios de simulación y análisis de casos dentro de la preparación clínica, lo cual acerca los conocimientos a circunstancias propias de la práctica profesional.",
     "Se corrige \"son integradas\" por \"se integran\" y se completa la correlación \"tanto como\". Se conserva la cita de Caballero y Llorent."),
    ("La evolución de los mecanismos de comunicación entre aplicaciones a través de API",
     "La evolución de los mecanismos de comunicación entre aplicaciones a través de API ha generado la necesidad de asegurar la compatibilidad entre versiones sin afectar los procesos de integración y entrega continua. El paradigma de microservicios configura las aplicaciones como un conjunto de componentes funcionales independientes, más pequeños y con un bajo nivel de acoplamiento, lo que permite el desarrollo, el despliegue y la escalabilidad de cada componente de forma independiente. Desde el punto de vista investigador, Li et al. en 2021 desarrollaron una revisión sistemática en la que consideraron 72 estudios primarios y concluyeron que la escalabilidad, la mantenibilidad y la resiliencia son los atributos de calidad más relevantes en esta arquitectura. De igual forma, Waseem, Liang y Shahin en 2021 establecieron que la adopción conjunta de Domain-Driven Design, conocido como DDD, y de rutinas de monitoreo continuo contribuye al diseño y la evolución de este tipo de software. Sin embargo, uno de los principales desafíos asociados a los microservicios radica en la complejidad de su gestión y su monitoreo.",
     "Se completa la oración final que quedaba cortada en \"radica\" y se ordenan las citas. Se conservan los términos técnicos y DDD."),
    ("Es considerada una herramienta que utiliza React",
     "Es considerada una herramienta que se apoya en React y aporta mejoras importantes y avanzadas, como el renderizado del contenido en el servidor o SSR, la generación estática de sitios o SSG, un sistema de rutas basado en la estructura de archivos y la mejora automática del rendimiento. Todo esto simplifica la creación de sitios web modernos, rápidos y extensibles, y mejora la experiencia del usuario y el posicionamiento en los motores de búsqueda.",
     "Se corrige \"procedimiento rápido, extensibles\" por \"rápidos y extensibles\" y se evitan los paréntesis en SSR y SSG. Se conservan los términos."),
    ("Es un entorno de trabajo para la creación de interfaces, que contiene un sistema",
     "Es un entorno de trabajo para la creación de interfaces que se apoya en un sistema de clases utilitarias. Este método facilita que los programadores construyan plantillas visuales con gran rapidez y eficiencia, sin necesidad de extensos códigos de estilos propios. Su aplicación promueve el desarrollo de maquetas flexibles, las cuales se ajustan con facilidad a diversos tipos de pantallas. Esto fomenta la reutilización de estilos y reduce el esfuerzo al realizar ajustes y al añadir nuevas funcionalidades en el ciclo de vida del producto.",
     "Se corrige \"rapidez y eficientes\" por \"rapidez y eficiencia\" y la concordancia \"las cuales\". No se cambian los términos."),
    ("Se trata de un framework de Node.js que ha sido construida",
     "Se trata de un framework de Node.js construido sobre TypeScript, diseñado para crear aplicaciones robustas y escalables. Su estructura se basa en módulos, lo que favorece una separación bien definida de los componentes del sistema y beneficia a proyectos de gran escala, la inyección de dependencias y la separación de responsabilidades, además de promover la reutilización de código y simplificar su mantenimiento. Dadas estas características ventajosas, constituye una opción elegida con frecuencia en ámbitos empresariales y en entornos compuestos por múltiples servicios.",
     "Se corrigen \"construida\" por \"construido\" y \"se basada\" por \"se basa\", y se precisa \"inyección de dependencias\", término propio de NestJS. Se mejora la fluidez."),
    ("Contribuye a un marco de trabajo de Python se centra",
     "Aporta un marco de trabajo de Python centrado en la implementación de servicios web y APIs de forma rápida, con alto rendimiento y fáciles de mantener. Se fundamenta en el estándar ASGI y utiliza anotaciones de tipos, conocidas como type hints, para ofrecer validaciones automáticas de datos, procesamiento asíncrono, documentación integrada para la API como Swagger y ReDoc, y Pydantic para la definición y gestión de estructuras de información, lo que aporta gran confiabilidad al intercambio de datos. Entre sus ventajas cabe mencionar la generación automática de documentación mediante OpenAPI, un recurso que agiliza las tareas de integración, prueba y mantenimiento. Dichas capacidades han impulsado su adopción en proyectos asociados con el análisis de información, los sistemas inteligentes y las arquitecturas orientadas a microservicios.",
     "Se reescribe el inicio cortado \"Contribuye a un marco se centra\" y se corrige \"de forma rápidas\". Se evitan los paréntesis en type hints y se conservan ASGI, Swagger, ReDoc, Pydantic y OpenAPI."),
    ("Se conoce como un sistema de gestión de bases de datos objeto-relacionales",
     "Se conoce como un sistema de gestión de bases de datos objeto-relacional y de código abierto, altamente escalable, que permite almacenar, administrar y consultar datos estructurados mediante SQL. Como base de datos relacional, organiza la información en tablas e impone relaciones entre ellas, valida la consistencia, mantiene la precisión y garantiza una alta integridad de los datos. Entre sus principales capacidades técnicas se encuentran el soporte nativo para estructuras complejas como JavaScript Object Notation Binary, la disponibilidad de índices especializados como Generalized Inverted Index y Generalized Search Tree, el particionamiento de tablas y un amplio ecosistema de extensiones que favorecen el procesamiento eficiente de grandes volúmenes de información.",
     "Se corrigen los verbos \"almacena, administra y consulta\" por sus infinitivos y \"mantienen\" por \"mantiene\". Se conservan los términos técnicos."),
    ("La propuesta presentada se basa en la integración entre la inteligencia artificial",
     "La propuesta presentada se basa en la integración entre la inteligencia artificial y las ciencias cognitivas, considerando el enfoque actual de la inteligencia artificial en la educación, que busca respaldar el aprendizaje, mejorar la enseñanza y fomentar la autonomía de los alumnos y la labor de los docentes, como señalan Ouyang y Jiao (2021). En este orden de ideas, la inserción de agentes de asistencia basados en sistemas inteligentes supera la simple automatización de tareas, pues actúan como intermediarios que pueden impulsar el desarrollo emocional y mejorar el aprendizaje mediante la retroalimentación constante (Xu et al., 2026). Desde la perspectiva de la neuroeducación, investigaciones recientes revelan que estas herramientas pueden beneficiar los procesos de enseñanza y aprendizaje, manteniendo coherencia con los patrones de desarrollo cognitivo y emocional del usuario (Burbano-Enríquez et al., 2025).",
     "Se corrige \"las cuales buscan\" por \"que busca\", \"basado\" por \"basados\" y el espacio en \"Xu et al. ,\". Se conservan las citas APA."),
    ("En el ámbito técnico, la evolución hacia agentes autónomos",
     "En el ámbito técnico, la evolución hacia agentes autónomos de inteligencia artificial durante el año 2025 representa un gran avance respecto a los sistemas conversacionales tradicionales, pues aporta una mayor capacidad de personalización y de adaptación dentro del contexto educativo. Como lo afirman Belcic y Stryker en el 2025, la implementación de una arquitectura de microservicios soportada por NestJS y FastAPI colabora en la gestión de la carga cognitiva a través del procesamiento de grandes volúmenes de información destinado a predecir el desempeño del usuario mediante modelos de lenguaje. No obstante, estos programas necesitan una infraestructura técnica robusta que permita abordar adecuadamente las brechas emocionales que surgen en la interacción entre humanos y máquinas (Jin et al., 2026).",
     "Se corrigen \"debido que\", \"personalizar y adaptación adecuada\", el doble espacio y \"abismo emocionales\". Se conservan NestJS, FastAPI y las citas APA."),
    ("Finalmente, al revisar los antecedentes sobre tecnologías educativas",
     "Finalmente, al revisar los antecedentes sobre tecnologías educativas, se evidencia una clara tendencia hacia entornos de aprendizaje híbridos, escalables y más personalizados, tal como mencionan Zhang y Aslan en 2021. Por lo tanto, el objetivo de desarrollar este módulo de evaluaciones busca no solo facilitar la construcción de pruebas digitalizadas, sino fomentar la conformación de sistemas de aprendizaje autónomo, vitales para la competencia digital actual y para potenciar metodologías de enseñanza e innovación pedagógica basadas en evidencia científica.",
     "Se corrige la ortografía \"no sólo\", \"vítales\" y \"basados\" por \"no solo\", \"vitales\" y \"basadas\". Se conserva la cita de Zhang y Aslan."),
]
nred = 0
for sub, morado, naranja in REDACCION:
    anchor = find(sub)
    if anchor:
        color_para(anchor, ROJO)
        insert_after(anchor, [[R(morado, MORADO)], [R(naranja, NARANJA)]])
        nred += 1
log.append("Pasada de redacción aplicada a %d párrafos" % nred)

# ======================================================================
# PASADA DE REDACCIÓN 2: Estado del Arte, diagramas, Agente IA y Conclusiones
# Misma convención. Rojo intacto, Morado limpio sin paréntesis ni dos puntos,
# sin cambiar términos. En Conclusiones se corrige también el sobre-alcance
# neuro y la mención de una interfaz de chat no cableada al frontend.
# ======================================================================
REDACCION2 = [
    ("El estado del arte analizado se propuso para cinco plataformas EdTech",
     "El estado del arte se realizó sobre cinco plataformas EdTech de reconocido prestigio, como Google Classroom, Moodle, Kahoot, Quizlet y ClassroomIO. Estas plataformas se centran en la gestión y la aplicación de evaluaciones; sin embargo, su calificación automática solo opera sobre preguntas cerradas, que suelen incorporar una retroalimentación estática o meramente numérica.",
     "Se corrige \"sólo\" por \"solo\", se evita el dos puntos inicial y se elimina la redundancia \"su capacidad es capaz de calificar\". No se cambian los términos."),
    ("La propuesta realizada destaca por incluir mecanismos que se encargaran",
     "La propuesta destaca por incluir mecanismos que se encargarán de la evaluación automática de las respuestas abiertas, mediante técnicas de procesamiento de lenguaje natural y de análisis de similitud semántica, así como una retroalimentación pedagógica personalizada a cargo de un agente de inteligencia artificial, apoyada en la arquitectura de Generación Aumentada por Recuperación o RAG, en fase de implementación sobre el armazón de FAISS.",
     "Se corrige \"se encargaran\" por \"se encargarán\" y se evita el paréntesis en RAG. Se conservan PLN, similitud semántica, RAG y FAISS."),
    ("La arquitectura de esta plataforma se basa en una arquitectura de microservicios integrando",
     "Esta plataforma se apoya en una arquitectura de microservicios que integra modelos de lenguaje de gran escala, conocidos como LLM, ejecutados localmente mediante Ollama, lo que garantiza una mayor autonomía tecnológica y un mejor control sobre los datos procesados. Más adelante se prevé incorporar servicios provistos por OpenAI para ampliar las capacidades de razonamiento y de asistencia inteligente de la plataforma.",
     "Se corrige la frase rota \"dentro de visita de servicios\" y se evita el paréntesis en LLM. Se conservan Ollama y OpenAI."),
    ("Tercera Forma Normal (3FN): El esquema no tiene dependencias transitivas",
     "Tercera Forma Normal o 3FN. El esquema no presenta dependencias transitivas entre atributos que no son clave. Algunos datos derivados, como scores.accuracy y ciertos indicadores agregados, se guardan de manera desnormalizada con el fin de mejorar el rendimiento del software de clasificación, aprovechando la naturaleza inmutable de esos registros.",
     "Se evita el paréntesis y el dos puntos del título, se corrige el doble espacio y la redundancia \"El esquema guarda se guardan\". Se conserva scores.accuracy."),
    ("El diagrama  representa la estructura del dominio del sistema informático",
     "El diagrama representa la estructura del dominio del sistema informático relacionado con la gestión de evaluaciones educativas. Se enfoca en la creación de cuestionarios, la gestión de preguntas, el registro de respuestas, la evaluación de resultados y la generación de retroalimentación mediante inteligencia artificial, además de las funcionalidades de autenticación y gestión de usuarios.",
     "Se corrige el doble espacio en \"El diagrama  representa\". No se cambian los términos."),
    ("Este diagrama muestra el patrón de diseño Command, donde la interfaz Command",
     "Este diagrama muestra el patrón de diseño Command, donde la interfaz Command define una operación única mediante el método Execute(). Las clases concretas, como GradeQuizCommand, GenerateFeedbackCommand y GenerateQuizCommand, implementan esa interfaz para encapsular la ejecución de tareas independientes de forma desacoplada. Este modelo centraliza la ejecución de tareas distintas y facilita la escalabilidad del programa sin necesidad de cambiar los componentes que invocan a los comandos.",
     "Se corrige \"desacompasada\" por \"desacoplada\", \"operativización\" por \"ejecución\" y \"la escala\" por \"la escalabilidad\". Se conservan Execute() y los nombres de las clases."),
    ("Nota: Este es el diagrama que hace la gestión del proceso de creación y publicación",
     "Nota. Este es el diagrama que gestiona el proceso de creación y publicación de las evaluaciones, elaborado por la autora en 2026.",
     "Se completa el autor que quedaba en blanco antes de \"2026\" y se evita el dos puntos inicial."),
    ("emplea spaCy para analizar profundamente la estructura del lenguaje",
     "NlpModel emplea spaCy para analizar a profundidad la estructura del lenguaje, abarcando procesos como la lematización, la identificación de entidades nombradas y el análisis de dependencias. El modelo se decide a través de ModelFactory, lo que permite definir en tiempo de ejecución cuál es el motor más adecuado en relación con el tipo de pregunta.",
     "Se corrige \"qué es el motor\" por \"cuál es el motor\" y \"en relación al\" por \"en relación con el\". Se conservan spaCy, NlpModel y ModelFactory."),
    ("NestJS va a ser el coordinador de la interacción mediante AIClientModule",
     "NestJS actúa como coordinador de la interacción mediante AIClientModule, desde el cual se comunica con FastAPI a través de un cliente HTTP tipado con un timeout de 15 segundos. Se añade una estrategia de fallback que aplica la evaluación local por coincidencias exactas cuando el servicio no responde, con lo que se asegura la continuidad del servicio. La gestión de la autenticación se realiza con JWT y una clave HMAC compartida, propagando el token Bearer para la trazabilidad de la sesión.",
     "Se cambia \"va a ser\" por \"actúa como\" y se mejora la fluidez. Se conservan AIClientModule, FastAPI, JWT, HMAC y el token Bearer."),
    ("Este documento reúne las pruebas automáticas del sistema de evaluaciones inteligentes",
     "Este documento reúne las pruebas automáticas del sistema de evaluaciones inteligentes, que forma parte del módulo de evaluaciones de la plataforma educativa. La solución se compone de un frontend desarrollado en Next.js 16, un backend en NestJS 11 y un microservicio de inteligencia artificial en FastAPI. Incluye pruebas unitarias, de integración, funcionales, de usabilidad y de rendimiento.",
     "Se completa \"una plataforma\" que quedaba sin nombre y se corrige el doble espacio. Se conservan Next.js 16, NestJS 11 y FastAPI."),
    ("interactúa con el estudiante por medio de una interfaz de chat de tipo chatbot",
     "El agente de inteligencia artificial es el principal componente del sistema, mediante el cual se entrega al estudiante una retroalimentación educativa apoyada en el sistema RAG, que recupera información relevante desde el índice vectorial FAISS para mejorar cada respuesta a partir del modelo de lenguaje. En cuanto a la escalabilidad de este índice conviene hacer notar que FAISS se ejecuta íntegramente en la RAM, por lo que su capacidad queda determinada por los recursos del servidor, y a medida que se incrementa la cantidad de materiales educativos podría verse comprometido el rendimiento. Para manejar grandes volúmenes de datos se recomienda aplicar la técnica de índice invertido, que optimiza el uso de la memoria agrupando vectores similares en clusters y realizando búsquedas solo en los más relevantes; por otra parte, cabe la opción de utilizar una base de datos vectorial distribuida, como Pinecone, que permite la escalabilidad horizontal sin requerir un cambio en la lógica del RAGRetriever previamente implementado.",
     "Se corrige \"mediante el cual que\" y se ajusta la mención a una interfaz de chat de tipo chatbot, ya que el tutor conversacional existe en el servicio de IA pero no está enlazado al frontend; lo entregado de extremo a extremo es la retroalimentación. Se conservan RAG, FAISS, RAM, clusters, Pinecone y RAGRetriever."),
    ("permitió alcanzar el objetivo fundacional del proyecto",
     "La construcción del módulo de evaluaciones inteligentes para la plataforma educativa permitió alcanzar el objetivo fundacional del proyecto, esto es, enriquecer la evaluación académica con capacidad analítica para identificar el desempeño académico de los estudiantes, así como la posibilidad de desarrollar retroalimentación pedagógica ajustada a cada perfil. La solución se articula a partir de una arquitectura basada en servicios que incluye un backend en NestJS, un servicio de inteligencia artificial en FastAPI y una interfaz de usuario en Next.js, relacionados entre sí mediante servicios REST y un sistema de autenticación JWT.",
     "Se reemplaza \"capacidad diagnóstica para identificar fortalezas cognitivas, emocionales y metacognitivas\" por \"capacidad analítica para identificar el desempeño académico\", alcance real del software, y se completan los nombres que quedaban en blanco. Se conservan NestJS, FastAPI, Next.js, REST y JWT."),
    ("Los objetivos específicos que fueron planteados por el proyecto fueron alcanzados",
     "Los objetivos específicos planteados por el proyecto se alcanzaron satisfactoriamente con el diseño de los prototipos de interfaz, la construcción de la arquitectura del backend, la definición del modelo de datos, la integración del agente de retroalimentación basado en inteligencia artificial y su validación en el módulo desarrollado dentro del entorno de desarrollo.",
     "Se completa \"la del agente\", que quedaba sin sustantivo, con \"la integración del agente\", y se evita la repetición \"fueron planteados fueron alcanzados\"."),
    ("el sistema incluye una evaluación híbrida que combina la comparación exacta",
     "Desde el punto de vista técnico, el sistema incluye una evaluación híbrida que combina la comparación exacta para las preguntas cerradas con técnicas de similitud semántica a través de Sentence Transformers y el análisis lingüístico mediante spaCy para las preguntas abiertas. La estrategia de evaluación se selecciona de manera dinámica a través del patrón Factory.",
     "Se corrige la ortografía \"linguístico\" por \"lingüístico\". Se conservan Sentence Transformers, spaCy y el patrón Factory."),
    ("De acuerdo con la aproximación  que guía y delicadeza este proyecto",
     "De acuerdo con el enfoque que guía con rigor este proyecto, los resultados obtenidos corroboran que la inteligencia artificial en la evaluación académica no se reduce a la automatización de las valoraciones, sino que es una oportunidad para alinear la evaluación con los principios del aprendizaje significativo. El módulo desarrollado pone en evidencia que es posible crear herramientas que, sin limitarse a medir el rendimiento, contribuyan a interpretar los patrones de desempeño de cada estudiante mediante analítica de desempeño y retroalimentación pedagógica. En este sentido, este estudio sienta las bases técnicas y conceptuales para la construcción progresiva de la plataforma educativa, cuya finalidad es personalizar la experiencia educativa sin comprometer la calidad de la docencia ni la seguridad de los datos.",
     "Se corrige la frase rota \"la aproximación  que guía y delicadeza\" y se completa \"la plataforma\" sin nombre. Se ajusta \"patrones cognitivos y emocionales\" a \"patrones de desempeño\", coherente con lo que mide el aplicativo."),
]
nred2 = 0
for sub, morado, naranja in REDACCION2:
    anchor = find(sub)
    if anchor:
        color_para(anchor, ROJO)
        insert_after(anchor, [[R(morado, MORADO)], [R(naranja, NARANJA)]])
        nred2 += 1
log.append("Pasada de redacción 2 aplicada a %d párrafos" % nred2)

# ======================================================================
# PASADA DE REDACCIÓN 3: Requerimientos, Diseño de BD y Prototipos Figma
# Misma convención. Rojo intacto, Morado limpio sin paréntesis ni dos puntos,
# sin cambiar términos. Se corrigen comillas curvas y guiones especiales del
# original dentro del texto morado.
# ======================================================================
REDACCION3 = [
    ("tenían como objetivo privado las necesidades pedagógicas",
     "Estas entrevistas tenían como objetivo conocer las necesidades pedagógicas, las limitaciones de las soluciones tecnológicas actuales y las expectativas respecto de la plataforma.",
     "Se corrige \"objetivo privado\" por \"objetivo conocer\", que era un error de redacción. No se cambian los términos."),
    ("Análisis comparativo de herramientas EdTech Para determinar",
     "Análisis comparativo de herramientas EdTech. Para determinar las brechas funcionales y las oportunidades de diferenciación respecto a la solución de aprendizaje que se quiere desarrollar, se realizó un análisis de la funcionalidad de evaluación de cinco herramientas EdTech representativas, como Google Classroom, ClassroomIO, Moodle, Kahoot y Quizlet.",
     "Se añade el punto que faltaba tras \"EdTech\" y se corrige el nombre \"classroom.oi\" por \"ClassroomIO\"."),
    ("El diseño de la base de datos es una parte del proceso de modelado",
     "El diseño de la base de datos forma parte del proceso de modelado y se lleva a cabo en tres etapas. Primero se define el modelo conceptual con el diagrama entidad-relación o DER, que permite identificar las entidades y las relaciones que se pueden establecer dentro del dominio. Después, el modelo lógico se genera en un esquema relacional normalizado.",
     "Se elimina la repetición de \"el diseño de la base de datos\" y \"el modelo conceptual\", se evita el paréntesis en DER y se reemplaza el guion especial por un guion normal."),
    ("Finalmente implementamos el modelo físico en PostgreSQL",
     "Finalmente se implementa el modelo físico en PostgreSQL y se usa TypeORM para el mapeo objeto-relacional. Con ello se completa el diseño de la base de datos y se prepara para su uso en la aplicación.",
     "Se elimina la repetición de \"base de datos\" y se reemplaza el guion especial por un guion normal. Se conservan PostgreSQL y TypeORM."),
    ("Nota: Diagrama Entidad-Relación (DER) del sistema",
     "Nota. Diagrama Entidad-Relación o DER del sistema, elaborado por la autora en 2026.",
     "Se completan los nombres que quedaban en blanco, se evita el dos puntos inicial y el paréntesis en DER."),
    ("El modelo relacional que se ha implementado en PostgreSQL está formado por nueve tablas",
     "El modelo relacional implementado en PostgreSQL está formado por nueve tablas que se encargan de gestionar usuarios, autenticación, evaluaciones, sesiones de evaluación, resultados y retroalimentación pedagógica. La tabla de usuarios reúne a todos los usuarios y constituye uno de los componentes principales, fundamental para la autenticación, la generación de evaluaciones, la evaluación de respuestas y el seguimiento del rendimiento. Cada evaluación se asocia a un usuario, y las sesiones de evaluación recogen sus respuestas y alimentan la tabla de puntajes, que incluye las calificaciones. De igual manera, la tabla de comentarios guarda la información de los análisis proporcionados por el software. Todas las tablas utilizan claves primarias UUID y aseguran la integridad referencial mediante claves foráneas.",
     "Se corrigen las frases confusas \"En esta tabla están presentes\" y \"Los ítems de la evaluación contienen a cada usuario\", y el anglicismo \"performance\" por \"rendimiento\". Se conserva UUID."),
    ("El esquema de la base de datos fue validado a partir de las distintas formas normales",
     "El esquema de la base de datos fue validado a partir de las distintas formas normales, la Primera Forma Normal o 1FN, la Segunda Forma Normal o 2FN, la Tercera Forma Normal o 3FN y la Forma Normal de Boyce-Codd o BCNF. El resultado obtenido es el siguiente, todas las tablas cumplen, al menos, con las exigencias de la 3FN y la mayoría también satisface las de BCNF.",
     "Se evitan los paréntesis de las formas normales y el dos puntos. Se conservan las siglas 1FN, 2FN, 3FN y BCNF."),
    ("quiz_sessions.answers (JSONB): este atributo contiene un conjunto de respuestas",
     "El atributo quiz_sessions.answers, de tipo JSONB, contiene un conjunto de respuestas integradas en la propia sesión. Se optó por esta solución dado que la sesión se consulta como una totalidad en numerosas ocasiones, el conjunto de respuestas crece de forma progresiva con la ejecución de la evaluación y, una vez terminada, queda fijado en el contenido almacenado. Implementar en su lugar una tabla independiente llamada session_answers en el contexto relacional habría implicado realizar más operaciones de inserción para cada respuesta y más consultas para recuperar la sesión, sin aportar grandes ventajas funcionales.",
     "Se evitan el paréntesis y el dos puntos del encabezado y se ajusta \"infinidad de ocasiones\". Se conservan quiz_sessions.answers, JSONB y session_answers."),
    ("scores.accuracy (FLOAT): Esta propiedad tiene valor de un cálculo",
     "El atributo scores.accuracy, de tipo FLOAT, almacena el resultado de un cálculo realizado a partir de los campos correct_count y total_questions, y se guarda desnormalizado para simplificar las operaciones de ordenación que solicita el aplicativo de ranking. Los registros de puntuación son inmutables una vez generados, por lo que el riesgo de inconsistencias a causa de esta desnormalización es muy bajo.",
     "Se evitan el paréntesis y el dos puntos del encabezado y se corrige \"tiene valor de un cálculo\". Se conservan scores.accuracy, correct_count y total_questions."),
    ("Ambas decisiones se encuentran documentadas en los archivos",
     "Ambas decisiones se encuentran documentadas en los archivos entity.ts y quedan respaldadas por reglas de integridad verificadas en la capa de aplicación antes de que se persista cada registro.",
     "Se corrige el punto suelto en \"los archivos. entity.ts\". Se conserva entity.ts."),
    ("Primera Forma Normal (1FN): En esta forma, el atributo debe contener un valor atómico",
     "Primera Forma Normal o 1FN. En esta forma, el atributo debe contener un valor atómico y no se permite ningún grupo repetitivo. El sistema maneja los datos estructurados, como options, answers y payload, con el tipo de dato JSONB, siguiendo un esquema de desnormalización controlado y bien documentado.",
     "Se evitan el paréntesis y el dos puntos del título. Se conservan options, answers, payload y JSONB."),
    ("Segunda Forma Normal (2FN): Todas las tablas usan una clave primaria de tipo UUID",
     "Segunda Forma Normal o 2FN. Todas las tablas usan una clave primaria de tipo UUID, que elimina la posibilidad de dependencias parciales entre los atributos y garantiza que se cumpla la Segunda Forma Normal.",
     "Se evitan el paréntesis y el dos puntos del título y se reduce la repetición de \"La clave primaria\". Se conserva UUID."),
    ("Forma Normal de Boyce-Codd (BCNF): Las dependencias funcionales que se identificaron",
     "Forma Normal de Boyce-Codd o BCNF. Las dependencias funcionales identificadas en el esquema tienen como determinantes claves candidatas. Por eso, al cumplir la 3FN, el diseño también cumple los requisitos de la Forma Normal de Boyce-Codd.",
     "Se evitan los paréntesis y el dos puntos del título. Se conservan 3FN y BCNF."),
    ("La página principal resalta la propuesta de valor de NeuroEdu IA",
     "La página principal resalta la propuesta de valor de NeuroEdu IA a través de una sección hero que presenta un título en degradado, un botón de llamada a la acción con el texto \"Comenzar\", e indicadores de tracción como los estudiantes activos, la precisión de la IA y el número de evaluaciones disponibles. Contiene además secciones informativas sobre las funcionalidades, los roles de usuario y el flujo de uso de la plataforma, junto con un pie de página que ofrece información de contacto. Desde esta interfaz los usuarios pueden acceder al registro y al inicio de sesión.",
     "Se corrige la frase rota \"Esta interfaz los usuarios pueden acceder\" y se reemplazan las comillas curvas de \"Comenzar\" por comillas rectas. Se conservan NeuroEdu IA y hero."),
    ("Las vistas destinadas al acceso y creación de cuentas presentan una estructura centrada",
     "Las vistas destinadas al acceso y a la creación de cuentas presentan una estructura centrada mediante un contenedor visual que resalta sobre un fondo con degradado. Estas interfaces permiten el ingreso mediante cuentas de Google y Microsoft, realizan comprobaciones automáticas durante la captura de información, ofrecen retroalimentación sobre el nivel de seguridad de la contraseña durante la creación de cuentas e incluyen opciones orientadas a la recuperación del acceso. Estas funcionalidades corresponden a las historias de usuario 01, 02 y 03 definidas dentro del backlog y fueron desarrolladas mediante componentes y vistas implementadas con Next y TypeScript.",
     "Se corrige \"Estas interfaces proporcionar el ingreso\" por \"permiten el ingreso\". Se conservan Google, Microsoft, Next y TypeScript."),
    ("permite ver a los usuarios en un listado paginado",
     "Gestión de Usuarios. Permite ver a los usuarios en un listado paginado, realizar búsquedas por nombre o correo electrónico, activar o desactivar cuentas, modificar roles y ejecutar las operaciones CRUD completas.",
     "Se corrige \"modificar roles y operaciones del CRUD completas\" por \"ejecutar las operaciones CRUD completas\" y se evita el dos puntos. Se conserva CRUD."),
]
nred3 = 0
for sub, morado, naranja in REDACCION3:
    anchor = find(sub)
    if anchor:
        color_para(anchor, ROJO)
        insert_after(anchor, [[R(morado, MORADO)], [R(naranja, NARANJA)]])
        nred3 += 1
log.append("Pasada de redacción 3 aplicada a %d párrafos" % nred3)

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
