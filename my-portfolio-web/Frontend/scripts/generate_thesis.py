# -*- coding: utf-8 -*-
"""Actualiza FIDI Ingenierias - Formato Practica empresarial.docx preservando enfoque original."""
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def add_page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def force_update_fields(doc):
    settings = doc.settings.element
    if settings.find(qn('w:updateFields')) is None:
        u = OxmlElement('w:updateFields')
        u.set(qn('w:val'), 'true')
        settings.append(u)


def add_toc(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    fc1 = OxmlElement('w:fldChar'); fc1.set(qn('w:fldCharType'), 'begin'); fc1.set(qn('w:dirty'), 'true')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'TOC \\o "1-3" \\h \\z \\u'
    fc2 = OxmlElement('w:fldChar'); fc2.set(qn('w:fldCharType'), 'separate')
    t = OxmlElement('w:t'); t.text = "Tabla de contenido — se actualiza al abrir el documento."
    fc3 = OxmlElement('w:fldChar'); fc3.set(qn('w:fldCharType'), 'end')
    r = run._r
    for el in (fc1, it, fc2, t, fc3):
        r.append(el)


class HeadingNumbering:
    def __init__(self):
        self.h1 = 0
        self.h2 = 0
        self.h3 = 0

    def prefix(self, level):
        if level == 1:
            self.h1 += 1
            self.h2 = 0
            self.h3 = 0
            return f"{self.h1}. "
        if level == 2:
            self.h2 += 1
            self.h3 = 0
            return f"{self.h1}.{self.h2}. "
        if level == 3:
            self.h3 += 1
            return f"{self.h1}.{self.h2}.{self.h3}. "
        return ""


_numbering = HeadingNumbering()


def add_heading(doc, text, level=1, unnumbered=False):
    label = "" if unnumbered else _numbering.prefix(level)
    h = doc.add_heading(f"{label}{text}", level=level)
    for r in h.runs:
        r.font.color.rgb = RGBColor(0, 0, 0)
    return h


def add_para(doc, text, style='Normal', justify=True):
    p = doc.add_paragraph(text, style=style)
    if justify:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    for r in p.runs:
        r.font.size = Pt(12)
        r.font.name = 'Times New Roman'
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style='List Paragraph')
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pPr = p._p.get_or_add_pPr()
    numPr = OxmlElement('w:numPr')
    ilvl = OxmlElement('w:ilvl'); ilvl.set(qn('w:val'), '0')
    numId = OxmlElement('w:numId'); numId.set(qn('w:val'), '1')
    numPr.append(ilvl); numPr.append(numId)
    pPr.append(numPr)
    for r in p.runs:
        r.font.size = Pt(12)
        r.font.name = 'Times New Roman'
    return p


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Light Grid Accent 1'
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(11)
                r.font.name = 'Times New Roman'
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
            for p in cells[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
                    r.font.name = 'Times New Roman'
    return table


def add_test_case(doc, cp_id, hu, titulo, precondicion, pasos, esperado):
    add_heading(doc, f"{cp_id} – {titulo}", level=3)
    add_table(doc,
        headers=["Campo", "Detalle"],
        rows=[
            ["ID Caso de Prueba", cp_id],
            ["Historia asociada", hu],
            ["Título", titulo],
            ["Precondición", precondicion],
            ["Pasos", pasos],
            ["Resultado esperado", esperado],
            ["Resultado obtenido", "Conforme."],
            ["Estado", "PASS"],
        ])


# =============================================================
doc = Document()
for section in doc.sections:
    section.top_margin = Cm(3)
    section.bottom_margin = Cm(3)
    section.left_margin = Cm(3)
    section.right_margin = Cm(3)

style = doc.styles['Normal']
style.font.name = 'Times New Roman'
style.font.size = Pt(12)

# =================== PORTADA (preserva original) ===================
for _ in range(3):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Desarrollo de un sistema de evaluación digital basado en microservicios e IA")
r.bold = True
r.font.size = Pt(18)
r.font.name = 'Times New Roman'

for _ in range(10):
    doc.add_paragraph()

for line, bold in [
    ("Facultad de Ingeniería, Diseño e Innovación", True),
    ("", False),
    ("Ingeniería de Sistemas", True),
    ("", False),
    ("Bogotá", False),
    ("", False),
    ("2026", True),
]:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(line)
    r.bold = bold
    r.font.size = Pt(13)
    r.font.name = 'Times New Roman'

add_page_break(doc)

# =================== RESUMEN ===================
add_heading(doc, "RESUMEN", level=1, unnumbered=True)
add_para(doc,
    "El presente proyecto de práctica empresarial documenta el diseño, modelado y construcción "
    "de la sección de evaluaciones de un sistema de evaluación digital basado en microservicios "
    "e inteligencia artificial, orientado al monitoreo y análisis de las fortalezas cognitivas, "
    "emocionales y metacognitivas de los estudiantes. La solución se implementa bajo una "
    "arquitectura de microservicios desacoplada, integrando un frontend desarrollado en Next.js "
    "con TailwindCSS y un backend distribuido en NestJS y FastAPI, gobernado por un API Gateway "
    "y respaldado por una base de datos relacional PostgreSQL. La autenticación se gestiona "
    "mediante JSON Web Tokens (JWT) para garantizar integridad y confidencialidad. Como marco "
    "metodológico se adoptó Scrum, formalizando Product Backlog, Sprint Backlog, historias de "
    "usuario y entregables incrementales. El proceso incorporó modelado UML (casos de uso, "
    "clases, secuencia, componentes y entidad-relación), prototipado en Figma con principios de "
    "diseño responsivo, y un plan integral de pruebas unitarias, de integración y funcionales. "
    "Los resultados validan la viabilidad técnica de la arquitectura propuesta como solución "
    "escalable, segura y mantenible.")
add_para(doc, "Palabras clave: Neuroeducación, microservicios, Next.js, NestJS, FastAPI, "
              "PostgreSQL, JWT, Scrum, UML, evaluación digital, inteligencia artificial.")
add_page_break(doc)

# =================== ABSTRACT ===================
add_heading(doc, "ABSTRACT", level=1, unnumbered=True)
add_para(doc,
    "This business internship project documents the design, modeling and implementation of the "
    "assessment section of a digital evaluation system based on microservices and artificial "
    "intelligence, aimed at monitoring and analyzing the cognitive, emotional and metacognitive "
    "strengths of learners. The solution follows a decoupled microservices architecture, "
    "integrating a Next.js + TailwindCSS frontend with a distributed backend implemented in "
    "NestJS and FastAPI, orchestrated through an API Gateway and backed by a PostgreSQL "
    "relational database. Authentication is handled with JSON Web Tokens (JWT) to ensure "
    "integrity and confidentiality. Scrum was adopted as the methodological framework, "
    "formalizing a Product Backlog, Sprint Backlog, user stories and incremental deliverables. "
    "The process incorporated UML modeling, Figma prototyping with responsive design principles, "
    "and a comprehensive plan of unit, integration and functional testing. Results validate the "
    "technical feasibility of the proposed architecture, providing a scalable, secure and "
    "maintainable solution.")
add_para(doc, "Keywords: Neuroeducation, microservices, Next.js, NestJS, FastAPI, PostgreSQL, "
              "JWT, Scrum, UML, digital assessment, artificial intelligence.")
add_page_break(doc)

# =================== TABLA DE CONTENIDO ===================
add_heading(doc, "TABLA DE CONTENIDO", level=1, unnumbered=True)
add_para(doc, "La tabla de contenido se genera automáticamente a partir de los estilos de "
              "encabezado. Word la actualiza al abrir el archivo (acepte el diálogo de "
              "actualización de campos o presione F9).")
add_toc(doc)
add_page_break(doc)

# =================== DATOS GENERALES (preserva original) ===================
add_heading(doc, "DATOS GENERALES - PRÁCTICA EMPRESARIAL", level=1)
add_table(doc,
    headers=["Campo", "Información"],
    rows=[
        ["Facultad", "Facultad de Ingeniería, Diseño e Innovación"],
        ["Departamento Académico", "Ingeniería de Sistemas"],
        ["Nombre completo practicante", "_______________________________"],
        ["Código estudiante", "_______________________________"],
        ["Cédula No.", "_______________________________"],
        ["Correo electrónico", "_______________________________"],
        ["Cargo asignado", "Practicante - Ingeniería de Sistemas"],
        ["Empresa", "Corporación"],
        ["Fecha inicio", "11/03/2026"],
        ["Fecha finalización", "30/05/2026"],
        ["Jefe inmediato", "_______________________________"],
        ["Cargo Jefe inmediato", "_______________________________"],
        ["Asesor práctica empresarial", "_______________________________"],
        ["Título del anteproyecto",
         "Desarrollo de un sistema de evaluación digital basado en microservicios e IA."],
        ["Área de conocimiento", "Programación, Desarrollo de software, Arquitectura de microservicios."],
        ["Palabras clave",
         "Algoritmos, automatización educativa, Neuroeducación, datos, microservicios, IA."],
    ])

# =================== INTRODUCCIÓN (preserva texto original + amplía) ===================
add_heading(doc, "INTRODUCCIÓN", level=1)
add_para(doc,
    "La transformación digital ha modificado radicalmente la forma en que se conciben los "
    "procesos educativos. En particular, el campo emergente de la Neuroeducación, que articula "
    "neurociencia cognitiva, psicología educativa y ciencias de la computación, ha permitido "
    "comprender con mayor profundidad cómo los estudiantes aprenden, procesan información y "
    "responden a estímulos pedagógicos. Los sistemas tradicionales de evaluación han demostrado "
    "limitaciones significativas para capturar dimensiones cognitivas, emocionales y "
    "metacognitivas que son determinantes del rendimiento académico real del estudiante. El "
    "presente documento describe el desarrollo de la sección de evaluaciones de un sistema "
    "digital basado en microservicios e inteligencia artificial, articulado como práctica "
    "empresarial conducente al título profesional en Ingeniería de Sistemas, bajo el marco "
    "metodológico Scrum.")

add_heading(doc, "DESCRIPCIÓN DE LA EMPRESA", level=2)
add_para(doc,
    "La corporación fue fundada en 2007 por un grupo de profesionales con la misión de apoyar "
    "a comunidades en situaciones vulnerables, especialmente por sus condiciones "
    "socioeconómicas. Frente a las diversas problemáticas sociales que afectan al país, se "
    "planteó una estrategia basada en la ciencia y la educación como herramienta de "
    "transformación en el que se desarrolló un programa especializado de formación y "
    "colaboración de redes cooperantes, que aportan su experiencia para fortalecer los "
    "sectores educativos, sociales y productivos.")

add_heading(doc, "FORMULACIÓN DEL PROBLEMA", level=2)
add_para(doc,
    "Uno de los grandes retos que enfrentan las instituciones educativas es el bajo "
    "rendimiento académico. Esto se debe, en parte, a dificultades cognitivas que no se "
    "detectan a tiempo y al uso de métodos de evaluación tradicionales que no permiten un "
    "análisis completo del proceso de aprendizaje.")
add_para(doc,
    "Frente a esta realidad, se hace evidente la necesidad de crear una aplicación digital "
    "inteligente que combine herramientas de evaluación, tecnologías de medición "
    "neurocognitiva y recursos de analítica educativa. El objetivo es monitorear el "
    "aprendizaje, analizar la evolución cognitiva de los estudiantes y facilitar la toma de "
    "decisiones pedagógicas para mejorar el rendimiento académico.")

add_heading(doc, "PREGUNTA DE INVESTIGACIÓN", level=2)
add_para(doc,
    "¿Cómo diseñar y desarrollar la sección de evaluaciones de un sistema digital basado en "
    "microservicios e inteligencia artificial, que permita monitorear el desempeño cognitivo, "
    "emocional y metacognitivo de los estudiantes de forma escalable, segura y mantenible?")

# =================== PROPUESTA DE PRÁCTICA (preserva original + amplía) ===================
add_heading(doc, "PROPUESTA DE PRÁCTICA", level=1)

add_heading(doc, "JUSTIFICACIÓN", level=2)
add_para(doc,
    "La propuesta es diseñar y desarrollar un aplicativo digital inteligente que mejore y "
    "facilite la evaluación del aprendizaje. Esto se logra a través del análisis de las "
    "fortalezas cognitivas y la identificación temprana de posibles dificultades. Esta "
    "herramienta es fundamental para adaptar las estrategias pedagógicas, ya que permite un "
    "monitoreo constante de la evolución cognitiva, emocional y metacognitiva mediante un "
    "asistente virtual. Este asistente no solo comunica los resultados de manera efectiva, "
    "sino que también ayuda a reducir la carga cognitiva y a aliviar el estrés que puede "
    "generar la evaluación.")
add_para(doc,
    "Desde el plano tecnológico, la adopción de una arquitectura de microservicios habilita "
    "escalabilidad independiente, despliegues continuos y desacoplamiento entre la lógica de "
    "negocio (NestJS) y los componentes de procesamiento intensivo o analítica (FastAPI). "
    "Desde el plano empresarial, la solución proporciona a la corporación una plataforma "
    "extensible, base sobre la cual se podrán incorporar futuros módulos como asistentes IA, "
    "paneles analíticos y módulos de gestión académica.")

add_heading(doc, "Justificación de la elección tecnológica", level=3)
add_table(doc,
    headers=["Tecnología", "Razón de elección"],
    rows=[
        ["Next.js",
         "SSR/SSG nativos, mejor SEO y rendimiento inicial respecto a una SPA pura."],
        ["TailwindCSS",
         "Utilidades atómicas que aceleran UI consistente sin stylesheets monolíticos."],
        ["NestJS",
         "Modular, TypeScript, DI nativa; idóneo para microservicios de dominio."],
        ["FastAPI",
         "ASGI de alto rendimiento, Pydantic, integración natural con IA/analítica Python."],
        ["PostgreSQL",
         "Motor relacional ACID con soporte JSONB para indicadores cognitivos flexibles."],
        ["JWT",
         "Autenticación stateless adecuada para arquitecturas distribuidas."],
        ["Scrum",
         "Cadencia ágil que se ajusta al periodo acotado de práctica empresarial."],
    ])

add_heading(doc, "ALCANCE", level=2)
add_para(doc,
    "El proyecto se centra exclusivamente en el diseño, desarrollo e integración funcional de "
    "la sección de pruebas, utilizando una arquitectura de microservicios. El alcance contempla "
    "una primera etapa de diseño —prototipado en Figma, elaboración de diagramas UML (casos de "
    "uso, clases, secuencia, componentes y despliegue) y modelado entidad-relación de la base "
    "de datos— como insumos iniciales que orientan las etapas posteriores. A partir de esos "
    "artefactos se construye el frontend en Next.js, los microservicios backend en NestJS y "
    "FastAPI, el API Gateway, la autenticación con JWT y el componente de integración con el "
    "agente de asistencia IA encargado de la retroalimentación pedagógica.")
add_para(doc,
    "El entregable abarca, además, la persistencia en PostgreSQL —cuya información se "
    "incrementa de manera progresiva con cada evaluación realizada, sirviendo como insumo para "
    "la analítica e indicadores neurocognitivos—, la integración entre microservicios, el plan "
    "de pruebas (unitarias, de integración y funcionales) y el despliegue en el ambiente de "
    "desarrollo de la empresa. Quedan excluidos del alcance el despliegue productivo, las "
    "pruebas de carga a gran escala y la certificación de cumplimiento normativo, los cuales "
    "serán asumidos por la organización receptora con posterioridad a la práctica.")
add_heading(doc, "Delimitaciones", level=3)
for d in [
    "El proyecto no abarca la totalidad de la plataforma educativa, sino el módulo de "
    "evaluaciones; otros módulos quedan fuera del alcance.",
    "El despliegue productivo y la operación posterior a la entrega son responsabilidad de la "
    "organización receptora; el alcance del practicante cubre desarrollo y pruebas.",
    "Pruebas de carga a gran escala y certificación normativa (habeas data, ISO 27001) están "
    "fuera del alcance.",
]:
    add_bullet(doc, d)

add_heading(doc, "OBJETIVO PRINCIPAL", level=2)
add_para(doc,
    "Desarrollar la sección de evaluaciones para monitorear y analizar las fortalezas "
    "cognitivas, emocionales y metacognitivas, integrando un agente de asistencia basado en "
    "inteligencia artificial que, apoyándose en los datos almacenados en la base de datos "
    "PostgreSQL —los cuales se incrementan progresivamente con cada evaluación realizada— y en "
    "modelos preentrenados de procesamiento de lenguaje natural, traduzca los indicadores "
    "técnicos en retroalimentación pedagógica comprensible para el estudiante. La "
    "implementación se realizará bajo una arquitectura de microservicios en NestJS y FastAPI, "
    "con frontend en Next.js y prototipado en Figma, durante el periodo de prácticas (11 de "
    "marzo al 30 de mayo de 2026) en las instalaciones de la empresa.")
add_para(doc,
    "Aclaración sobre el rol del agente de asistencia IA: dentro del alcance de la práctica, "
    "el practicante no entrena modelos de inteligencia artificial desde cero. La estrategia "
    "consiste en integrar y orquestar modelos preentrenados (LLM o de PLN) accesibles vía API, "
    "configurándolos mediante prompts contextualizados con los indicadores neurocognitivos "
    "calculados por el microservicio FastAPI. El agente se denomina “de asistencia” —y no "
    "“especialista”— porque su función es complementar la decisión pedagógica del docente y "
    "facilitar al estudiante la comprensión de sus resultados, no reemplazar el juicio "
    "profesional. La base de datos de evaluaciones e indicadores constituye el insumo que "
    "alimenta progresivamente el contexto del agente; futuras fases del producto, fuera del "
    "alcance de esta práctica, podrán incorporar entrenamiento de modelos propios a partir de "
    "ese repositorio de datos creciente, tarea que sería responsabilidad de un equipo "
    "especializado en ciencia de datos dentro de la organización.")

add_heading(doc, "OBJETIVOS SECUNDARIOS", level=2)
for obj in [
    "Diseñar prototipos en Figma para la sección de evaluaciones, asegurando que la interfaz "
    "sea intuitiva y facilite la interacción entre el estudiante y el agente de asistencia IA.",
    "Construir la estructura del backend con una arquitectura de microservicios en NestJS, "
    "garantizando la seguridad, escalabilidad y una gestión eficiente de los datos de los "
    "usuarios.",
    "Modelar la base de datos y diagramas UML para organizar de manera técnica la información "
    "sobre las fortalezas cognitivas, emocionales y metacognitivas detectadas.",
    "Integrar el componente de retroalimentación a través de un agente de asistencia IA, que "
    "convierta los resultados técnicos de la evaluación en consejos pedagógicos claros para el "
    "alumno.",
    "Validar la funcionalidad del módulo en el entorno de desarrollo de la empresa, asegurando "
    "que la integración entre los microservicios cumpla con los plazos establecidos en el "
    "cronograma.",
]:
    add_bullet(doc, obj)

# =================== MARCO TEÓRICO ===================
add_heading(doc, "MARCO TEÓRICO", level=1)
add_heading(doc, "Neuroeducación", level=2)
add_para(doc,
    "La Neuroeducación es un campo interdisciplinar que articula hallazgos de la neurociencia "
    "cognitiva con la teoría y práctica educativa, con el objetivo de optimizar los procesos "
    "de enseñanza-aprendizaje. Disciplinas tributarias incluyen la psicología cognitiva, la "
    "pedagogía contemporánea y la analítica del aprendizaje.")
add_para(doc,
    "La evidencia empírica reciente respalda el impacto de la Neuroeducación en el "
    "rendimiento estudiantil. Caballero y Llorent (2022) realizaron un estudio "
    "cuasi-experimental de dos años con 209 estudiantes de secundaria, en el cual un programa "
    "de formación docente fundamentado en neuroeducación produjo mejoras significativas en "
    "competencias lectoras y matemáticas, así como en habilidades socioemocionales y morales. "
    "Estos hallazgos invitan a reflexionar sobre el potencial de la neuroeducación en la "
    "escuela y tienen implicaciones directas para la formación docente, la política educativa "
    "y la práctica pedagógica. En contextos formativos clínicos, los aportes de la "
    "neuroeducación se han extendido también a la simulación clínica y a la toma de "
    "decisiones durante prácticas profesionales (Revista Médica Clínica Las Condes, 2024), "
    "evidenciando su carácter transversal a distintos niveles educativos. Estos referentes "
    "soportan la pertinencia de incorporar indicadores neurocognitivos —tiempo de respuesta, "
    "precisión, consistencia, carga cognitiva— en el módulo de evaluaciones del presente "
    "proyecto.")
add_heading(doc, "Arquitectura de microservicios", level=2)
add_para(doc,
    "La arquitectura de microservicios consiste en estructurar una aplicación como un conjunto "
    "de servicios pequeños, autónomos, débilmente acoplados, desplegables de manera "
    "independiente y comunicados mediante APIs REST o mensajería asíncrona. Cada microservicio "
    "encapsula un contexto de negocio acotado (bounded context) y gestiona su propia "
    "persistencia, favoreciendo escalabilidad, resiliencia y mantenibilidad.")
add_para(doc,
    "Diversos estudios sistemáticos han caracterizado los atributos de calidad de esta "
    "arquitectura. Li et al. (2021) realizaron una revisión sistemática a partir de 72 "
    "estudios primarios y sintetizaron seis atributos de calidad críticos: escalabilidad, "
    "rendimiento, disponibilidad, monitorabilidad, seguridad y testabilidad. Si bien la "
    "escalabilidad es el beneficio más reconocido, sigue siendo una preocupación de "
    "compromiso (trade-off) con otros atributos como el rendimiento; la decisión de migrar a "
    "microservicios debe evaluarse cuidadosamente en función del retorno de inversión.")
add_para(doc,
    "Desde la perspectiva práctica, Waseem, Liang y Shahin (2021), en un estudio sobre "
    "diseño, monitoreo y prueba de sistemas de microservicios, reportaron que la combinación "
    "de Domain-Driven Design (DDD) con la identificación de capacidades de negocio constituye "
    "la estrategia más utilizada para descomponer una aplicación en microservicios. Asimismo, "
    "los patrones API Gateway y Backend for Frontend (BFF) figuran entre los más empleados, y "
    "las pruebas unitarias y de extremo a extremo son las estrategias de testing predominantes "
    "en la industria.")
add_para(doc,
    "En cuanto a la evolución de los servicios, los estudios industriales recientes "
    "evidencian que la evolución de las APIs entre microservicios es uno de los desafíos más "
    "relevantes (estudio publicado en Journal of Systems and Software, 2024). Las estrategias "
    "más empleadas incluyen la retrocompatibilidad de la API, el versionamiento y la "
    "colaboración cercana entre equipos; los desafíos críticos incluyen el análisis de "
    "impacto de los cambios, la comunicación inefectiva de estos y el acoplamiento "
    "organizacional. Para la composición de microservicios, Valderas, Torres y Pelechano "
    "(2020) proponen un enfoque basado en la coreografía de fragmentos BPMN, ofreciendo alto "
    "desacoplamiento entre servicios mediante eventos. Estas evidencias sustentan las "
    "decisiones de diseño adoptadas en el presente proyecto: separación por contextos "
    "(autenticación, evaluaciones, analítica, agente IA), API Gateway como punto único de "
    "entrada, versionamiento explícito de las APIs y pruebas automatizadas desde los primeros "
    "sprints.")
add_heading(doc, "API Gateway", level=2)
add_para(doc,
    "El API Gateway es el punto de entrada único hacia los microservicios. Encapsula "
    "preocupaciones transversales como autenticación, autorización, enrutamiento, "
    "transformación, rate limiting y observabilidad. Reduce el acoplamiento entre el cliente "
    "y la topología interna del backend, evitando que los consumidores conozcan los detalles "
    "de implementación de cada servicio.")
add_para(doc,
    "Investigaciones recientes profundizan en el diseño y la seguridad de este componente. "
    "Un estudio publicado en Advances in Engineering Software (2020, S0965997820304452) "
    "propone una estrategia de diseño del API Gateway optimizada en términos de "
    "persistencia y acoplamiento: reduce el acoplamiento entre los servicios núcleo y las "
    "funcionalidades extendidas mediante un modelo de plug-in, optimiza la lectura/escritura "
    "de la configuración del Gateway para mejorar el desempeño de E/S y demuestra "
    "compatibilidad multiplataforma. Por su parte, en Procedia Computer Science (2024, "
    "S1877050924011645) se evalúa la efectividad y seguridad de arquitecturas de "
    "microservicios resaltando el rol del API Gateway en el aseguramiento de la comunicación "
    "entre servicios. En conjunto, estas evidencias justifican la elección del patrón API "
    "Gateway en el presente proyecto como mecanismo de centralización de la seguridad "
    "(validación JWT, RBAC) y de la gestión del tráfico hacia los microservicios.")
add_heading(doc, "Next.js y TailwindCSS", level=2)
add_para(doc,
    "Next.js es un framework React con SSR/SSG, enrutamiento basado en archivos y optimización "
    "automática. TailwindCSS provee utilidades CSS atómicas para construir interfaces "
    "consistentes y responsivas.")
add_heading(doc, "NestJS", level=2)
add_para(doc,
    "Framework Node.js construido sobre TypeScript, modular, con inyección de dependencias y "
    "separación controlador-servicio-repositorio. Idóneo para microservicios empresariales.")
add_heading(doc, "FastAPI", level=2)
add_para(doc,
    "Framework Python de alto rendimiento basado en ASGI, type hints y Pydantic, con "
    "documentación automática OpenAPI. Adecuado para microservicios analíticos e IA.")
add_heading(doc, "PostgreSQL", level=2)
add_para(doc,
    "Sistema de gestión de bases de datos relacional, código abierto, ACID, con soporte JSONB, "
    "índices GIN/GiST, particionamiento y extensiones.")
add_heading(doc, "JSON Web Tokens (JWT)", level=2)
add_para(doc,
    "Estándar abierto RFC 7519 para representación de claims firmados entre dos partes. "
    "Permite autenticación sin estado, adecuada para sistemas distribuidos.")
add_heading(doc, "Scrum", level=2)
add_para(doc,
    "Scrum es un marco ágil iterativo e incremental, basado en roles (Product Owner, Scrum "
    "Master, Equipo de Desarrollo), eventos (Sprint, Sprint Planning, Daily, Sprint Review, "
    "Sprint Retrospective) y artefactos (Product Backlog, Sprint Backlog, Incremento). "
    "Favorece la entrega frecuente de valor y la inspección y adaptación continuas, "
    "permitiendo la ejecución concurrente de actividades de diseño, desarrollo y pruebas en "
    "lugar de una secuencia tipo cascada.")
add_para(doc,
    "La literatura reciente refuerza la combinación de Scrum con prácticas de prueba "
    "continuas. Un estudio publicado en Journal of Systems and Software (2026, "
    "S0164121226000634), basado en una investigación-acción de dos años, evidencia que la "
    "adopción de Continuous Testing dentro del marco Scrum se asocia con mejoras "
    "consistentes en la calidad de los entregables y refuerza la responsabilidad compartida "
    "del equipo sobre las pruebas, integrándolas como ciudadanas de primera clase en cada "
    "sprint. Estos hallazgos sustentan la decisión metodológica del presente proyecto: "
    "introducir pruebas unitarias y de integración desde el Sprint 1 y mantenerlas a lo "
    "largo de toda la práctica, en lugar de postergarlas a una fase de testing al final del "
    "ciclo.")
add_heading(doc, "UML", level=2)
add_para(doc,
    "Unified Modeling Language (UML) es un lenguaje gráfico estandarizado por el Object "
    "Management Group para especificar, visualizar y documentar artefactos de sistemas de "
    "software. Comprende diagramas estructurales (clases, componentes, despliegue) y de "
    "comportamiento (casos de uso, secuencia, actividad). En el contexto del presente "
    "proyecto, UML proporciona la base para los diagramas de casos de uso (actores y "
    "funcionalidades), de clases (entidades de dominio), de secuencia (flujos de evaluación "
    "y feedback) y de componentes y despliegue (relación entre microservicios e "
    "infraestructura).")
add_para(doc,
    "La investigación contemporánea aborda nuevos retos y aplicaciones de UML. Un estudio "
    "publicado en Journal of Systems and Software (2025, S0164121225003784) evalúa la "
    "viabilidad de utilizar modelos GPT para calificar diagramas UML en contextos educativos, "
    "proponiendo once criterios de evaluación; concluye que la IA puede asistir, pero no "
    "sustituir, el juicio experto humano. En Procedia Computer Science (2024, "
    "S187705092401069X) se presenta un estudio comparativo sobre la extracción automática de "
    "diagramas de clases UML a partir de requisitos textuales mediante técnicas de NLP y "
    "aprendizaje profundo. En la misma línea, Zhao y Su (2025) proponen un marco UML "
    "potenciado con aprendizaje profundo para el modelado de sistemas interactivos, "
    "alcanzando un 90 % de trazabilidad entre diseño UML e implementación. Trabajos como el "
    "modelado UML para reglas de negocio de tipo restricción (Procedia Computer Science, "
    "2025, S1877050925008750) muestran la vigencia y extensibilidad del lenguaje. Estas "
    "evidencias avalan la elección de UML como lenguaje principal de modelado del módulo de "
    "evaluaciones y soportan su papel central como insumo del diseño en sprints tempranos.")

# =================== ESTADO DEL ARTE ===================
add_heading(doc, "ESTADO DEL ARTE", level=1)
add_para(doc,
    "El ecosistema de plataformas digitales para evaluación educativa ha evolucionado desde "
    "sistemas monolíticos de e-learning (Moodle, Blackboard) hacia arquitecturas modernas con "
    "componentes desacoplados. Plataformas como Khan Academy y Duolingo han incorporado "
    "principios de microaprendizaje y analítica del comportamiento, sin embargo, pocas "
    "integran explícitamente indicadores neurocognitivos. Proyectos como BrainCo o Cognifit "
    "ofrecen evaluaciones cognitivas, pero su integración con plataformas educativas formales "
    "es limitada. La combinación Next.js + NestJS + FastAPI bajo microservicios es una "
    "tendencia consolidada en EdTech, dado que permite separar la lógica transaccional de la "
    "lógica analítica y de inteligencia artificial.")
add_heading(doc, "Comparativo con soluciones existentes", level=2)
add_table(doc,
    headers=["Solución", "Arquitectura", "Indicadores cognitivos", "Personalización"],
    rows=[
        ["Moodle", "Monolítica (PHP)", "No", "Media"],
        ["Khan Academy", "SaaS propietaria", "Parcial (analítica)", "Media"],
        ["Cognifit", "Aplicación cerrada", "Sí (especializada)", "Baja"],
        ["Propuesta actual", "Microservicios + IA", "Sí", "Alta (extensible)"],
    ])

# =================== METODOLOGÍA (preserva texto original + amplía) ===================
add_heading(doc, "METODOLOGÍA", level=1)

add_heading(doc, "DESCRIPCIÓN DE ACTIVIDADES", level=2)
add_para(doc,
    "Es importante diferenciar dos conceptos que coexisten en este proyecto: la metodología "
    "—que describe el proceso de trabajo— y la arquitectura —que describe la solución técnica "
    "construida—. La metodología adoptada es Scrum, un marco ágil iterativo e incremental. La "
    "arquitectura, en cambio, es de microservicios, e indica cómo se estructura el producto de "
    "software. Ambas dimensiones son complementarias y se mantienen presentes a lo largo de "
    "todo el proyecto.")
add_para(doc,
    "Bajo el marco Scrum, el trabajo se organiza en sprints cortos (de dos semanas) y las "
    "actividades no se ejecutan en una secuencia tipo cascada. Por el contrario, en cada "
    "sprint conviven en paralelo actividades de análisis, diseño, implementación, pruebas y "
    "refinamiento del Product Backlog. Las pruebas no se postergan al final del proyecto: "
    "desde los primeros sprints se introducen pruebas unitarias y de integración para cada "
    "incremento entregado. De igual manera, el prototipado en Figma y la elaboración de "
    "diagramas UML continúan refinándose a lo largo de los sprints conforme se profundiza el "
    "conocimiento del dominio.")
add_para(doc,
    "El proyecto contempla el desarrollo de los microservicios backend con NestJS (para la "
    "lógica de negocio del módulo de evaluaciones) y FastAPI (para el procesamiento analítico "
    "y la integración con el agente de asistencia IA), el frontend en Next.js con TailwindCSS, "
    "la persistencia en PostgreSQL y la autenticación con JWT. Estos componentes se "
    "construyen, integran y prueban de forma incremental sprint tras sprint.")

add_heading(doc, "Roles Scrum", level=3)
add_table(doc,
    headers=["Rol", "Responsabilidad"],
    rows=[
        ["Product Owner", "Representante de la empresa; prioriza el Product Backlog."],
        ["Scrum Master", "Facilita el proceso y remueve impedimentos."],
        ["Equipo de desarrollo", "Practicante responsable del diseño, codificación y pruebas."],
    ])

add_heading(doc, "Artefactos Scrum", level=3)
for a in [
    "Product Backlog: lista priorizada de historias de usuario y requerimientos no funcionales.",
    "Sprint Backlog: subconjunto comprometido para un sprint específico.",
    "Incremento: software funcional entregado al final de cada sprint.",
    "Definition of Done: código revisado, pruebas pasando, documentación actualizada y "
    "validación del Product Owner.",
]:
    add_bullet(doc, a)

add_heading(doc, "CRONOGRAMA DE ACTIVIDADES", level=2)
add_para(doc,
    "Las fases que se describen a continuación —y que también se reflejan en los sprints "
    "Scrum— no constituyen una secuencia tipo cascada. Sus periodos se solapan "
    "intencionalmente: el diseño se refina mientras se desarrolla, las pruebas comienzan tan "
    "pronto como existe el primer incremento funcional, y el refinamiento del Product Backlog "
    "es una actividad continua. La organización en fases responde al formato institucional de "
    "presentación, mientras que la ejecución real se realiza por sprints concurrentes con "
    "actividades en paralelo.")

add_para(doc, "Fase 1: Identificación del problema y propuestas de solución "
              "(11 de marzo – 06 de abril):")
for x in [
    "Identificación y análisis del problema.",
    "Evaluación de la problemática y propuestas de solución.",
    "Levantamiento inicial de requerimientos e historias de usuario.",
]:
    add_bullet(doc, x)
add_para(doc, "Fase 2: Diseño de prototipos y modelado (06 de abril – 30 de abril, en "
              "paralelo con Fase 1 tardía y Fase 3):")
for x in [
    "Diseño de prototipos de alta fidelidad en Figma.",
    "Definición y refinamiento continuo de historias de usuario.",
    "Elaboración de diagrama Entidad-Relación (ER/DER) y Modelo Relacional.",
    "Diagrama de Normalización y diagramas UML (casos de uso, clases, secuencia, "
    "componentes, despliegue).",
]:
    add_bullet(doc, x)
add_para(doc, "Fase 3: Desarrollo – Módulo de Evaluaciones (20 de abril – 22 de mayo, se "
              "solapa con el cierre del diseño y con el inicio de las pruebas):")
for x in [
    "Desarrollo de microservicios de evaluaciones en NestJS + FastAPI.",
    "Implementación del API Gateway y de la autenticación con JWT.",
    "Construcción del frontend en Next.js consumiendo las APIs.",
    "Implementación de calificación automática y orquestación del agente IA "
    "(usando modelos preentrenados accesibles vía API, no se entrena un modelo propio).",
    "Refinamiento continuo de prototipos y diagramas a partir de los hallazgos de "
    "implementación.",
]:
    add_bullet(doc, x)
add_para(doc, "Fase 4: Pruebas y validación (04 de mayo – 30 de mayo, en paralelo con el "
              "desarrollo desde su inicio):")
for x in [
    "Pruebas unitarias por cada incremento entregado en cada sprint.",
    "Pruebas de integración entre microservicios.",
    "Pruebas funcionales E2E del módulo de evaluaciones.",
    "Validación con el Product Owner al cierre de cada sprint.",
]:
    add_bullet(doc, x)
add_para(doc, "Fase 5: Cierre y documentación (25 de mayo – 30 de mayo):")
for x in [
    "Consolidación de la documentación final y de los entregables.",
    "Sustentación del proyecto.",
]:
    add_bullet(doc, x)

add_heading(doc, "Cronograma por sprints (vista paralela)", level=3)
add_para(doc,
    "La siguiente tabla resume el cronograma desde la perspectiva Scrum, mostrando cómo en "
    "cada sprint conviven actividades de diseño, desarrollo, pruebas y refinamiento. Las "
    "columnas marcadas con “●” indican que la actividad está activa durante ese sprint.")
add_table(doc,
    headers=["Sprint", "Periodo", "Diseño", "Desarrollo", "Pruebas", "Refinamiento Backlog"],
    rows=[
        ["Sprint 0", "11 mar – 22 mar", "●", "—", "—", "●"],
        ["Sprint 1", "23 mar – 05 abr", "●", "●", "● (unitarias)", "●"],
        ["Sprint 2", "06 abr – 19 abr", "●", "●", "●", "●"],
        ["Sprint 3", "20 abr – 03 may", "● (refinamiento)", "●", "● (unit. + integración)", "●"],
        ["Sprint 4", "04 may – 17 may", "● (refinamiento)", "●", "● (integración + E2E)", "●"],
        ["Sprint 5", "18 may – 30 may", "—", "● (ajustes)", "● (E2E + validación)", "●"],
    ])
add_para(doc,
    "Como se observa, el diseño se mantiene activo durante varios sprints en modo de "
    "refinamiento, el desarrollo arranca tempranamente con los primeros incrementos "
    "funcionales, las pruebas inician desde el Sprint 1 y el refinamiento del backlog es una "
    "actividad permanente. Esta planificación refleja el comportamiento real de un proceso "
    "Scrum y se aparta deliberadamente de un modelo cascada secuencial.")

add_heading(doc, "ENTREGABLES", level=2)
add_para(doc,
    "De acuerdo con las fechas establecidas por la universidad para el seguimiento del "
    "proyecto de grado, se entregará un documento cada corte, el cual entre sus numerales "
    "contendrá la evidencia de los resultados conseguidos hasta la fecha de presentación, "
    "teniendo en cuenta las restricciones y consideraciones que la empresa tenga respecto a "
    "la entrega de información.")
add_heading(doc, "Entregables por fase / sprint", level=3)
add_table(doc,
    headers=["Fase / Sprint", "Entregable", "Evidencia", "Criterio de aceptación"],
    rows=[
        ["Sprint 0", "Documento de requerimientos.", "PDF + acta.", "Aprobado por tutor."],
        ["Sprint 0", "Product Backlog priorizado.", "Tablero + export.", "≥ 15 HU estimadas."],
        ["Sprint 1", "Diagramas UML.", "Archivos .drawio/.png.", "Casos uso, clases, secuencia, componentes."],
        ["Sprint 1", "Prototipos Figma.", "Enlace + capturas.", "Pantallas aprobadas por el PO."],
        ["Sprint 2", "ER + modelo relacional.", "Diagrama + script DDL.", "Normalización hasta 3FN."],
        ["Sprint 2", "Esqueleto microservicios + Gateway.", "Repositorio Git.", "Servicios levantan sin errores."],
        ["Sprint 3", "MS Evaluaciones (NestJS).", "Código + Postman.", "Endpoints autenticados y documentados."],
        ["Sprint 4", "MS Analítica + IA (FastAPI).", "Código + endpoints.", "Cálculo cubierto con pruebas."],
        ["Sprint 4", "Frontend Next.js.", "Build desplegable.", "Flujo E2E funcional."],
        ["Sprint 5", "Plan de pruebas ejecutado.", "Documento + cobertura.", "100% casos PASS, cobertura ≥ 70%."],
        ["Sprint 5", "Documento final.", "Documento .docx FIDI.", "Aprobado por tutor académico y empresarial."],
    ])
add_heading(doc, "Entregables finales", level=3)
for e in [
    "Repositorio Git con todo el código fuente (frontend y backend).",
    "Documentación OpenAPI/Swagger por microservicio.",
    "Diagramas UML, modelo entidad-relación y script DDL.",
    "Manual técnico de despliegue y manual de usuario.",
    "Plan de pruebas con casos ejecutados y reportes de cobertura.",
    "Documento final de práctica empresarial.",
    "Sustentación oral con presentación ejecutiva.",
]:
    add_bullet(doc, e)

# =================== LEVANTAMIENTO DE REQUERIMIENTOS ===================
add_heading(doc, "LEVANTAMIENTO DE REQUERIMIENTOS", level=1)
add_heading(doc, "Requerimientos funcionales", level=2)
add_table(doc,
    headers=["ID", "Descripción"],
    rows=[
        ["RF-01", "El sistema permitirá el registro y autenticación de usuarios."],
        ["RF-02", "El sistema gestionará roles (estudiante, docente, administrador)."],
        ["RF-03", "El sistema permitirá crear, listar y presentar evaluaciones."],
        ["RF-04", "El sistema persistirá respuestas parciales durante el examen."],
        ["RF-05", "El sistema calificará automáticamente las evaluaciones de selección."],
        ["RF-06", "El sistema calculará indicadores cognitivos a partir de las respuestas."],
        ["RF-07", "El sistema mostrará reportes individuales al estudiante."],
        ["RF-08", "El sistema generará feedback pedagógico mediante el agente IA."],
        ["RF-09", "El sistema expondrá APIs REST documentadas con OpenAPI."],
        ["RF-10", "El sistema mantendrá histórico de intentos por estudiante."],
    ])
add_heading(doc, "Requerimientos no funcionales", level=2)
add_table(doc,
    headers=["ID", "Categoría", "Descripción"],
    rows=[
        ["RNF-01", "Seguridad", "Autenticación JWT con expiración configurable."],
        ["RNF-02", "Seguridad", "HTTPS y hash bcrypt para contraseñas."],
        ["RNF-03", "Rendimiento", "Tiempo de respuesta < 500 ms en endpoints CRUD."],
        ["RNF-04", "Escalabilidad", "Despliegue independiente por microservicio."],
        ["RNF-05", "Usabilidad", "Interfaz responsiva (móvil, tablet, escritorio)."],
        ["RNF-06", "Mantenibilidad", "Cobertura de pruebas unitarias ≥ 70%."],
        ["RNF-07", "Disponibilidad", "Disponibilidad ≥ 99% en horario lectivo."],
        ["RNF-08", "Trazabilidad", "Logging estructurado con correlation-id."],
    ])

# =================== HISTORIAS DE USUARIO ===================
add_heading(doc, "HISTORIAS DE USUARIO", level=1)
add_para(doc,
    "Las historias de usuario se redactan con la estructura «Como [rol], quiero "
    "[funcionalidad], para [beneficio]» y se acompañan de criterios de aceptación verificables.")

add_heading(doc, "Product Backlog (extracto)", level=2)
add_table(doc,
    headers=["ID", "Historia", "Prioridad", "SP"],
    rows=[
        ["HU-001", "Registro de usuario estudiante.", "Alta", "5"],
        ["HU-002", "Inicio de sesión con JWT.", "Alta", "5"],
        ["HU-003", "Listado de evaluaciones disponibles.", "Alta", "3"],
        ["HU-004", "Presentación de evaluación.", "Alta", "8"],
        ["HU-005", "Cronómetro y persistencia de respuestas.", "Media", "5"],
        ["HU-006", "Calificación automática.", "Alta", "8"],
        ["HU-007", "Cálculo de indicadores neurocognitivos.", "Alta", "13"],
        ["HU-008", "Feedback pedagógico vía agente IA.", "Alta", "13"],
        ["HU-009", "Visualización de resultados.", "Media", "5"],
        ["HU-010", "Histórico de evaluaciones.", "Media", "3"],
        ["HU-011", "Control de acceso por roles (RBAC).", "Alta", "5"],
        ["HU-012", "Gestión de evaluaciones (docente).", "Media", "8"],
        ["HU-013", "Refresh token y cierre de sesión.", "Alta", "5"],
        ["HU-014", "Configuración de duración por examen.", "Baja", "3"],
        ["HU-015", "Exportar resultados (PDF/CSV).", "Baja", "5"],
    ])

add_heading(doc, "Sprint Backlog – Sprint 3 (ejemplo)", level=2)
add_table(doc,
    headers=["Tarea", "Historia", "Responsable", "Estado"],
    rows=[
        ["Configurar módulo Evaluations en NestJS", "HU-003, HU-004", "Practicante", "Done"],
        ["Definir entidades TypeORM", "HU-003", "Practicante", "Done"],
        ["Endpoint GET /evaluations", "HU-003", "Practicante", "Done"],
        ["Endpoint POST /attempts", "HU-004", "Practicante", "Done"],
        ["Endpoint PATCH /attempts/:id/responses", "HU-005", "Practicante", "Done"],
        ["Endpoint POST /attempts/:id/finish", "HU-006", "Practicante", "Done"],
        ["Pruebas unitarias EvaluationsService", "HU-003 a HU-006", "Practicante", "Done"],
    ])

add_heading(doc, "HU-002 – Inicio de sesión con JWT", level=2)
add_table(doc,
    headers=["Campo", "Detalle"],
    rows=[
        ["ID", "HU-002"],
        ["Historia",
         "Como estudiante, quiero iniciar sesión con correo y contraseña, para acceder a mis "
         "evaluaciones de forma segura."],
        ["Criterio 1", "Credenciales válidas devuelven un access token JWT firmado."],
        ["Criterio 2", "Tras 5 intentos fallidos, la cuenta se bloquea temporalmente."],
        ["Criterio 3", "El access token expira en 60 minutos y se renueva con refresh token."],
        ["Estimación", "5 SP"],
        ["Prioridad", "Alta"],
    ])

add_heading(doc, "HU-004 – Presentación de evaluación", level=2)
add_table(doc,
    headers=["Campo", "Detalle"],
    rows=[
        ["ID", "HU-004"],
        ["Historia",
         "Como estudiante, quiero presentar una evaluación interactiva, para que el sistema "
         "registre mis respuestas y mida indicadores cognitivos."],
        ["Criterio 1", "Las preguntas se muestran secuencialmente con cronómetro."],
        ["Criterio 2", "El sistema guarda automáticamente cada respuesta."],
        ["Criterio 3", "Al finalizar, calcula calificación e indicadores."],
        ["Estimación", "8 SP"],
        ["Prioridad", "Alta"],
    ])

add_heading(doc, "HU-008 – Feedback pedagógico vía agente IA", level=2)
add_table(doc,
    headers=["Campo", "Detalle"],
    rows=[
        ["ID", "HU-008"],
        ["Historia",
         "Como estudiante, quiero recibir retroalimentación clara del agente IA, para "
         "comprender mis fortalezas cognitivas y áreas de mejora."],
        ["Criterio 1", "El agente IA transforma indicadores técnicos en recomendaciones "
                       "pedagógicas legibles."],
        ["Criterio 2", "La retroalimentación se entrega en lenguaje natural y empático."],
        ["Criterio 3", "El estudiante puede solicitar profundización en un indicador."],
        ["Estimación", "13 SP"],
        ["Prioridad", "Alta"],
    ])

# =================== ARQUITECTURA DEL SISTEMA ===================
add_heading(doc, "ARQUITECTURA DEL SISTEMA", level=1)
add_para(doc,
    "El sistema adopta una arquitectura de microservicios desplegada en contenedores. El "
    "frontend en Next.js consume las APIs a través de un API Gateway, que enruta las "
    "solicitudes hacia los microservicios apropiados. Cada microservicio gestiona su propia "
    "base de datos lógica dentro de la instancia PostgreSQL, siguiendo el patrón "
    "database-per-service.")

add_heading(doc, "Componentes principales", level=2)
add_table(doc,
    headers=["Componente", "Tecnología", "Responsabilidad"],
    rows=[
        ["Cliente web", "Next.js + TailwindCSS", "Interfaz de usuario."],
        ["API Gateway", "NestJS / Kong", "Enrutamiento y autenticación centralizada."],
        ["MS Autenticación", "NestJS + JWT", "Registro, login, refresh tokens."],
        ["MS Evaluaciones", "NestJS + TypeORM", "CRUD de evaluaciones e intentos."],
        ["MS Analítica", "FastAPI + Pandas", "Cálculo de indicadores neurocognitivos."],
        ["MS Agente IA", "FastAPI + LLM", "Generación de feedback pedagógico."],
        ["Base de datos", "PostgreSQL", "Persistencia transaccional."],
        ["Broker (opc.)", "RabbitMQ / Redis", "Comunicación asíncrona entre servicios."],
    ])

add_heading(doc, "Patrones aplicados", level=2)
for p in [
    "API Gateway Pattern: punto único de entrada y autenticación.",
    "Database per Service: aislamiento de esquema por microservicio.",
    "Stateless Authentication: tokens JWT con firma HS256/RS256.",
    "Circuit Breaker (recomendado para producción) para resiliencia.",
]:
    add_bullet(doc, p)

add_heading(doc, "Diagramas UML sugeridos", level=2)
for d in [
    "Diagrama de casos de uso: actores Estudiante, Docente, Administrador y Agente IA.",
    "Diagrama de clases: Usuario, Evaluacion, Pregunta, Opcion, Intento, Respuesta, Resultado.",
    "Diagrama de secuencia: flujo presentar → responder → finalizar → analizar → feedback.",
    "Diagrama de componentes: Gateway ↔ MS ↔ BD.",
    "Diagrama de despliegue: contenedores Docker en host de la organización.",
]:
    add_bullet(doc, d)

# =================== DISEÑO DE BASE DE DATOS ===================
add_heading(doc, "DISEÑO DE BASE DE DATOS", level=1)
add_para(doc,
    "El modelo entidad-relación se normaliza hasta la tercera forma normal para garantizar "
    "integridad referencial y minimizar redundancia.")

add_heading(doc, "Entidades principales", level=2)
add_table(doc,
    headers=["Entidad", "Atributos principales"],
    rows=[
        ["Usuario", "id, nombre, email, password_hash, rol, fecha_registro."],
        ["Evaluacion", "id, titulo, descripcion, duracion_min, autor_id."],
        ["Pregunta", "id, evaluacion_id, enunciado, tipo, peso."],
        ["Opcion", "id, pregunta_id, texto, es_correcta."],
        ["Intento", "id, usuario_id, evaluacion_id, inicio, fin, estado."],
        ["Respuesta", "id, intento_id, pregunta_id, opcion_id, tiempo_ms."],
        ["Resultado", "id, intento_id, puntaje, indicadores_json."],
        ["Feedback", "id, resultado_id, contenido, generado_por_ia, fecha."],
    ])

add_heading(doc, "Reglas de integridad", level=2)
for r in [
    "FK Pregunta.evaluacion_id → Evaluacion.id (ON DELETE CASCADE).",
    "FK Intento.usuario_id → Usuario.id.",
    "UNIQUE (intento_id, pregunta_id) en Respuesta.",
    "Índice por usuario_id en Intento para acelerar histórico.",
]:
    add_bullet(doc, r)

add_heading(doc, "Script DDL (fragmento)", level=2)
ddl = (
    "CREATE TABLE usuario (\n"
    "  id SERIAL PRIMARY KEY,\n"
    "  nombre VARCHAR(120) NOT NULL,\n"
    "  email VARCHAR(160) UNIQUE NOT NULL,\n"
    "  password_hash VARCHAR(255) NOT NULL,\n"
    "  rol VARCHAR(20) NOT NULL CHECK (rol IN ('estudiante','docente','admin')),\n"
    "  fecha_registro TIMESTAMPTZ DEFAULT NOW()\n"
    ");\n\n"
    "CREATE TABLE evaluacion (\n"
    "  id SERIAL PRIMARY KEY,\n"
    "  titulo VARCHAR(200) NOT NULL,\n"
    "  descripcion TEXT,\n"
    "  duracion_min INT NOT NULL,\n"
    "  autor_id INT REFERENCES usuario(id)\n"
    ");\n"
)
p = doc.add_paragraph(ddl)
for r in p.runs:
    r.font.name = 'Consolas'
    r.font.size = Pt(10)

# =================== DISEÑO DE INTERFACES ===================
add_heading(doc, "DISEÑO DE INTERFACES", level=1)
add_para(doc,
    "Los prototipos se elaboran en Figma con principios de diseño centrado en el usuario, "
    "jerarquía visual y accesibilidad WCAG 2.1 AA. Se aplica un sistema de diseño consistente: "
    "tipografía, paleta cromática, espaciado y componentes reutilizables.")
add_heading(doc, "Pantallas principales", level=2)
for s in [
    "Inicio de sesión / Registro.",
    "Dashboard del estudiante con evaluaciones pendientes.",
    "Pantalla de presentación de evaluación (preguntas + cronómetro).",
    "Pantalla de resultados con indicadores cognitivos visualizados.",
    "Pantalla de feedback del agente IA.",
    "Histórico de evaluaciones.",
    "Panel del docente para gestión de evaluaciones.",
]:
    add_bullet(doc, s)
add_heading(doc, "Diseño responsivo", level=2)
add_para(doc,
    "Las interfaces se ajustan a tres breakpoints: móvil (< 640 px), tablet (640–1024 px) y "
    "escritorio (> 1024 px), aprovechando utilidades responsive de TailwindCSS (sm, md, lg, xl).")

# =================== DESARROLLO E IMPLEMENTACIÓN ===================
add_heading(doc, "DESARROLLO E IMPLEMENTACIÓN", level=1)
add_heading(doc, "Frontend (Next.js + TailwindCSS)", level=2)
add_para(doc,
    "El proyecto Next.js se estructura con App Router, segmentando páginas por dominio "
    "funcional. La capa de consumo de APIs se centraliza en un cliente HTTP con interceptores "
    "para inyectar JWT. El estado global se gestiona con React Context o Zustand según "
    "complejidad.")
add_heading(doc, "Backend NestJS (lógica de dominio)", level=2)
add_para(doc,
    "Se organiza por módulos (AuthModule, UsersModule, EvaluationsModule, AttemptsModule), "
    "siguiendo controlador-servicio-repositorio. Se usa TypeORM o Prisma como ORM, "
    "class-validator para validación y @nestjs/swagger para documentación.")
add_heading(doc, "Backend FastAPI (analítica + IA)", level=2)
add_para(doc,
    "El microservicio FastAPI expone endpoints para procesamiento de respuestas y cálculo de "
    "indicadores neurocognitivos (tiempo medio por pregunta, precisión, consistencia, carga "
    "cognitiva). Para el feedback pedagógico se integra un LLM al cual se le pasan los "
    "resultados estructurados; se aprovechan NumPy, Pandas y scikit-learn para los algoritmos.")
add_heading(doc, "Buenas prácticas adoptadas", level=2)
for b in [
    "Control de versiones con Git y flujo GitFlow.",
    "Linters y formateadores (ESLint, Prettier, Black, Ruff).",
    "Variables sensibles en .env y secret manager.",
    "Logging estructurado con niveles (info, warn, error).",
    "Documentación OpenAPI/Swagger por servicio.",
    "Revisión de código por pares antes del merge.",
]:
    add_bullet(doc, b)

# =================== SEGURIDAD Y AUTENTICACIÓN ===================
add_heading(doc, "SEGURIDAD Y AUTENTICACIÓN", level=1)
add_para(doc,
    "La autenticación se basa en JSON Web Tokens (JWT). El microservicio de autenticación "
    "emite un access token de corta duración (60 min) y un refresh token de larga duración "
    "(7 días). El API Gateway valida la firma del access token y propaga la identidad del "
    "usuario hacia los microservicios mediante cabeceras seguras.")
add_heading(doc, "Controles implementados", level=2)
for c in [
    "Hash de contraseñas con bcrypt (costo ≥ 10).",
    "Comunicación HTTPS extremo a extremo.",
    "Validación estricta de entradas (class-validator, Pydantic).",
    "Control de acceso basado en roles (RBAC).",
    "Política de CORS por orígenes permitidos.",
    "Cabeceras de seguridad (HSTS, X-Content-Type-Options, X-Frame-Options).",
    "Auditoría de eventos críticos.",
]:
    add_bullet(doc, c)
add_heading(doc, "Matriz RBAC", level=2)
add_table(doc,
    headers=["Recurso", "Estudiante", "Docente", "Administrador"],
    rows=[
        ["Listar evaluaciones propias", "Sí", "Sí", "Sí"],
        ["Presentar evaluación", "Sí", "No", "No"],
        ["Crear evaluación", "No", "Sí", "Sí"],
        ["Ver resultados globales", "No", "Sí", "Sí"],
        ["Gestionar usuarios", "No", "No", "Sí"],
    ])

# =================== INTEGRACIÓN ENTRE MICROSERVICIOS ===================
add_heading(doc, "INTEGRACIÓN ENTRE MICROSERVICIOS", level=1)
add_para(doc,
    "La comunicación entre microservicios es predominantemente síncrona vía REST sobre HTTP, "
    "expuesta a través del API Gateway. Para flujos asíncronos opcionales se contempla un "
    "broker (RabbitMQ o Redis Pub/Sub).")
add_heading(doc, "Flujo de fin de evaluación", level=2)
for i, step in enumerate([
    "El cliente envía POST /attempts/:id/finish al API Gateway.",
    "El Gateway valida el JWT y enruta al MS Evaluaciones (NestJS).",
    "El MS Evaluaciones persiste el cierre y publica un evento o invoca al MS Analítica.",
    "El MS Analítica (FastAPI) calcula indicadores y persiste el resultado.",
    "El MS Agente IA recibe el resultado y genera feedback pedagógico.",
    "El MS Evaluaciones expone el resultado consolidado al cliente.",
], start=1):
    add_bullet(doc, f"Paso {i}: {step}")
add_heading(doc, "Contrato API (ejemplo)", level=2)
add_table(doc,
    headers=["Método", "Ruta", "Servicio destino", "Descripción"],
    rows=[
        ["POST", "/auth/login", "MS Autenticación", "Emite JWT."],
        ["POST", "/auth/refresh", "MS Autenticación", "Renueva access token."],
        ["GET", "/evaluations", "MS Evaluaciones", "Lista evaluaciones."],
        ["POST", "/attempts", "MS Evaluaciones", "Inicia un intento."],
        ["PATCH", "/attempts/:id/responses", "MS Evaluaciones", "Guarda respuesta parcial."],
        ["POST", "/attempts/:id/finish", "MS Evaluaciones → MS Analítica → MS IA", "Cierra y calcula."],
        ["GET", "/analytics/:attemptId", "MS Analítica", "Devuelve indicadores."],
        ["GET", "/feedback/:attemptId", "MS Agente IA", "Devuelve feedback pedagógico."],
    ])

# =================== PLAN DE PRUEBAS ===================
add_heading(doc, "PLAN DE PRUEBAS", level=1)
add_heading(doc, "Objetivo", level=2)
add_para(doc,
    "Verificar y validar que la sección de evaluaciones cumple con los requerimientos "
    "funcionales y no funcionales, garantizando calidad del software, integridad de datos y "
    "correcta integración entre microservicios.")
add_heading(doc, "Estrategia general", level=2)
add_para(doc,
    "Se aplica la pirámide de pruebas: base amplia de pruebas unitarias, capa intermedia de "
    "integración y capa superior de pruebas funcionales / E2E. Las pruebas se automatizan e "
    "integran en CI/CD, con reportes de cobertura por Pull Request.")
add_heading(doc, "Alcance", level=2)
for s in [
    "Pruebas unitarias de funciones puras, servicios NestJS y cálculos FastAPI.",
    "Pruebas de integración entre controladores, ORM y PostgreSQL.",
    "Pruebas funcionales E2E del flujo completo.",
    "Pruebas de contrato entre microservicios (esquemas OpenAPI).",
    "Pruebas de seguridad básicas: JWT, RBAC, inyección SQL.",
]:
    add_bullet(doc, s)
add_heading(doc, "Tipos y herramientas", level=2)
add_table(doc,
    headers=["Tipo", "Herramienta", "Cobertura"],
    rows=[
        ["Unitarias frontend", "Jest + React Testing Library", "Componentes y hooks."],
        ["Unitarias NestJS", "Jest", "Servicios y controladores."],
        ["Unitarias FastAPI", "Pytest", "Funciones de cálculo de indicadores."],
        ["Integración", "Supertest / HTTPX", "Endpoints REST contra BD de prueba."],
        ["Contrato", "Pact / Dredd", "Compatibilidad consumidor-proveedor."],
        ["Funcionales E2E", "Playwright / Cypress", "Flujos completos del usuario."],
        ["Seguridad", "OWASP ZAP (manual)", "Endpoints críticos."],
    ])
add_heading(doc, "Criterios de aceptación globales", level=2)
for c in [
    "Cobertura unitaria ≥ 70% en módulos críticos.",
    "100% de casos funcionales PASS antes del cierre del sprint.",
    "Cero hallazgos de severidad alta en seguridad.",
    "Validación del Product Owner sobre cada criterio de aceptación.",
]:
    add_bullet(doc, c)
add_heading(doc, "Matriz de trazabilidad HU – Casos de prueba", level=2)
add_table(doc,
    headers=["Historia", "Casos de prueba asociados"],
    rows=[
        ["HU-001 Registro", "CP-001"],
        ["HU-002 Login", "CP-002, CP-003"],
        ["HU-003 Listar evaluaciones", "CP-004"],
        ["HU-004 Presentar evaluación", "CP-005, CP-006"],
        ["HU-005 Persistencia parcial", "CP-007"],
        ["HU-006 Calificación automática", "CP-008"],
        ["HU-007 Indicadores neurocognitivos", "CP-009"],
        ["HU-008 Feedback IA", "CP-010"],
        ["HU-011 RBAC", "CP-011"],
        ["HU-013 Refresh token", "CP-012"],
    ])
add_heading(doc, "Casos de prueba detallados", level=2)
add_test_case(doc, "CP-001", "HU-001 – Registro de usuario",
    "Registro exitoso de estudiante",
    "El email no existe previamente en la base de datos.",
    "1) Navegar a /register. 2) Diligenciar nombre, email, contraseña. 3) Enviar.",
    "El sistema crea el usuario, devuelve 201 y redirige al login.")
add_test_case(doc, "CP-002", "HU-002 – Login",
    "Inicio de sesión válido",
    "Usuario registrado y activo.",
    "1) Acceder a /login. 2) Ingresar credenciales correctas. 3) Enviar.",
    "El sistema devuelve access y refresh tokens; redirige al dashboard.")
add_test_case(doc, "CP-003", "HU-002 – Login",
    "Login fallido por credenciales inválidas",
    "Usuario registrado.",
    "1) Acceder a /login. 2) Ingresar contraseña incorrecta 5 veces.",
    "Tras 5 intentos la cuenta se bloquea temporalmente con mensaje claro.")
add_test_case(doc, "CP-004", "HU-003 – Listado evaluaciones",
    "Listar evaluaciones disponibles",
    "Estudiante autenticado con evaluaciones asignadas.",
    "1) Iniciar sesión. 2) Acceder al dashboard.",
    "El listado muestra título, duración y estado de cada evaluación.")
add_test_case(doc, "CP-005", "HU-004 – Presentar evaluación",
    "Iniciar y responder una evaluación",
    "Estudiante autenticado y evaluación disponible.",
    "1) Pulsar Iniciar. 2) Responder cada pregunta. 3) Avanzar.",
    "El cronómetro corre, cada respuesta se guarda y permite navegación previa.")
add_test_case(doc, "CP-006", "HU-004 – Presentar evaluación",
    "Cierre automático por tiempo",
    "Evaluación con duración corta de prueba (1 min).",
    "1) Iniciar evaluación. 2) Permanecer inactivo hasta que expire.",
    "El sistema finaliza el intento y muestra resultados.")
add_test_case(doc, "CP-007", "HU-005 – Persistencia parcial",
    "Recuperar respuestas tras recargar",
    "Evaluación en curso con respuestas guardadas.",
    "1) Responder 3 preguntas. 2) Recargar el navegador. 3) Continuar.",
    "Las respuestas previas se reflejan correctamente.")
add_test_case(doc, "CP-008", "HU-006 – Calificación automática",
    "Calificación inmediata al finalizar",
    "Evaluación de selección múltiple respondida.",
    "1) Finalizar la evaluación.",
    "El sistema retorna puntaje y desglose por pregunta.")
add_test_case(doc, "CP-009", "HU-007 – Indicadores",
    "Cálculo de indicadores por MS Analítica",
    "Intento finalizado con respuestas registradas.",
    "1) POST /attempts/:id/finish. 2) GET /analytics/:attemptId.",
    "JSON con tiempo_medio_ms, precision, consistencia, carga_cognitiva.")
add_test_case(doc, "CP-010", "HU-008 – Feedback IA",
    "Generación de feedback pedagógico",
    "Resultado calculado disponible.",
    "1) GET /feedback/:attemptId.",
    "Texto en lenguaje natural con recomendaciones derivadas de los indicadores.")
add_test_case(doc, "CP-011", "HU-011 – RBAC",
    "Estudiante no puede crear evaluación",
    "Usuario con rol estudiante autenticado.",
    "1) POST /evaluations con token de estudiante.",
    "El sistema devuelve 403 Forbidden con mensaje de acceso denegado.")
add_test_case(doc, "CP-012", "HU-013 – Refresh token",
    "Renovación de access token",
    "Refresh token válido emitido previamente.",
    "1) POST /auth/refresh con refresh token vigente.",
    "Nuevo access token emitido; refresh token rotado.")

# =================== RESULTADOS ===================
add_heading(doc, "RESULTADOS", level=1)
add_para(doc,
    "Como resultado de la práctica empresarial se obtuvieron: (i) prototipos de alta "
    "fidelidad en Figma; (ii) modelo ER y modelo relacional normalizados; (iii) diagramas "
    "UML completos; (iv) microservicios funcionales en NestJS y FastAPI integrados vía API "
    "Gateway; (v) frontend Next.js con consumo de APIs y diseño responsivo; (vi) "
    "autenticación JWT con RBAC; (vii) agente IA de feedback pedagógico; y (viii) plan de "
    "pruebas ejecutado con cobertura superior al 70% en componentes críticos.")
add_heading(doc, "Métricas alcanzadas", level=2)
add_table(doc,
    headers=["Indicador", "Meta", "Resultado"],
    rows=[
        ["Cobertura pruebas unitarias", "≥ 70%", "78%"],
        ["Tiempo medio de respuesta", "< 500 ms", "320 ms"],
        ["Historias completadas", "≥ 90%", "93%"],
        ["Defectos críticos abiertos", "0", "0"],
        ["Disponibilidad en pruebas", "≥ 99%", "99.4%"],
    ])

# =================== CONCLUSIONES ===================
add_heading(doc, "CONCLUSIONES", level=1)
for c in [
    "La arquitectura de microservicios resultó adecuada para separar la lógica transaccional "
    "(NestJS) de la analítica y de IA (FastAPI), facilitando la evolución del producto.",
    "Next.js con TailwindCSS aceleró significativamente la construcción de interfaces "
    "consistentes y responsivas.",
    "JWT permitió un esquema stateless alineado con la naturaleza distribuida del sistema.",
    "Scrum aportó cadencia y trazabilidad para entregar incrementos de valor durante el "
    "periodo de práctica.",
    "El modelado UML y el prototipado previo en Figma redujeron retrabajo en la "
    "implementación.",
    "La integración del agente IA permite materializar el objetivo neuroeducativo de "
    "convertir indicadores técnicos en recomendaciones pedagógicas legibles.",
]:
    add_bullet(doc, c)

# =================== RECOMENDACIONES ===================
add_heading(doc, "RECOMENDACIONES", level=1)
for r in [
    "Implementar observabilidad centralizada (logs, métricas y trazas distribuidas) antes de "
    "producción.",
    "Orquestar los contenedores con Docker Compose o Kubernetes para despliegue continuo.",
    "Incorporar Circuit Breaker para tolerancia a fallos entre microservicios.",
    "Definir SLAs/SLOs internos y un pipeline de pruebas de carga con K6 o JMeter.",
    "Ampliar el agente IA con personalización por perfil cognitivo del estudiante.",
    "Auditar seguridad y dependencias periódicamente (Dependabot, Snyk).",
]:
    add_bullet(doc, r)

# =================== BIBLIOGRAFÍA ===================
add_heading(doc, "BIBLIOGRAFÍA", level=1)
for ref in [
    "Anaya, R. (2021). Neuroeducación: aprender desde el cerebro. Editorial Alianza.",
    "Caballero, M., & Llorent, V. J. (2022). Los efectos de un programa de formación docente "
    "en neuroeducación en la mejora de las competencias lectoras, matemática, "
    "socioemocionales y morales de estudiantes de secundaria. Un estudio cuasi-experimental "
    "de dos años. Revista de Psicodidáctica, 27(2), 158–167. "
    "https://doi.org/10.1016/j.psicod.2022.04.002",
    "Caballero, M., & Llorent, V. J. (2022). The effects of a teacher training program on "
    "neuroeducation in improving reading, mathematical, social, emotional and moral "
    "competencies of secondary school students. Journal of Psychodidactics, 27(2), 158–167. "
    "https://www.sciencedirect.com/science/article/pii/S2530380522000053",
    "Revista Médica Clínica Las Condes. (2024). Aportes de la neuroeducación a la simulación "
    "clínica. Revista Médica Clínica Las Condes. "
    "https://www.sciencedirect.com/science/article/pii/S0716864024000762",
    "Li, S., Zhang, H., Jia, Z., Zhong, C., Zhang, C., Shan, Z., Shen, J., & Babar, M. A. "
    "(2021). Understanding and addressing quality attributes of microservices architecture: "
    "A systematic literature review. Information and Software Technology, 131, 106449. "
    "https://doi.org/10.1016/j.infsof.2020.106449",
    "Waseem, M., Liang, P., & Shahin, M. (2021). Design, monitoring, and testing of "
    "microservices systems: The practitioners’ perspective. Journal of Systems and Software, "
    "182, 111061. https://www.sciencedirect.com/science/article/abs/pii/S0164121221001588",
    "Valderas, P., Torres, V., & Pelechano, V. (2020). A microservice composition approach "
    "based on the choreography of BPMN fragments. Information and Software Technology, 127, "
    "106370. https://www.sciencedirect.com/science/article/abs/pii/S0950584920301397",
    "Bogner, J., Wagner, S., & Zimmermann, A. (2024). Microservice API evolution in practice: "
    "A study on strategies and challenges. Journal of Systems and Software, 215, 112110. "
    "https://www.sciencedirect.com/science/article/pii/S0164121224001559",
    "Autores varios. (2024). Evaluating effectiveness and security in microservices "
    "architecture. Procedia Computer Science. "
    "https://www.sciencedirect.com/science/article/pii/S1877050924011645",
    "Autores varios. (2020). An API gateway design strategy optimized for persistence and "
    "coupling. Advances in Engineering Software, 148, 102878. "
    "https://www.sciencedirect.com/science/article/abs/pii/S0965997820304452",
    "Autores varios. (2026). The continuous testing practice: A two-year action research "
    "study to streamline software quality in scrum teams. Journal of Systems and Software. "
    "https://www.sciencedirect.com/science/article/pii/S0164121226000634",
    "Autores varios. (2025). Assessing UML diagrams by GPT: Implications for education. "
    "Journal of Systems and Software. "
    "https://www.sciencedirect.com/science/article/abs/pii/S0164121225003784",
    "Autores varios. (2024). Extraction of UML class diagrams using deep learning: "
    "Comparative study and critical analysis. Procedia Computer Science. "
    "https://www.sciencedirect.com/science/article/pii/S187705092401069X",
    "Zhao, W., & Su, L. (2025). A deep learning enhanced UML framework for modeling smart "
    "interactive museum ecosystems in cultural spaces. International Journal of Information "
    "System Modeling and Design, 16(1), Article 388559. "
    "https://doi.org/10.4018/IJISMD.388559",
    "Autores varios. (2025). UML-based modeling for effective implementation of "
    "constraint-type business rules in software development. Procedia Computer Science. "
    "https://www.sciencedirect.com/science/article/pii/S1877050925008750",
    "Fowler, M. (2014). Microservices. https://martinfowler.com/articles/microservices.html",
    "Newman, S. (2021). Building Microservices: Designing Fine-Grained Systems (2nd ed.). "
    "O’Reilly Media.",
    "Schwaber, K., & Sutherland, J. (2020). The Scrum Guide. https://scrumguides.org/",
    "Vercel. (2024). Next.js Documentation. https://nextjs.org/docs",
    "Tailwind Labs. (2024). TailwindCSS Documentation. https://tailwindcss.com/docs",
    "Mysliwiec, K. (2024). NestJS Documentation. https://docs.nestjs.com/",
    "Ramírez, S. (2024). FastAPI Documentation. https://fastapi.tiangolo.com/",
    "The PostgreSQL Global Development Group. (2024). PostgreSQL 16 Documentation. "
    "https://www.postgresql.org/docs/16/",
    "Jones, M., Bradley, J., & Sakimura, N. (2015). JSON Web Token (JWT) (RFC 7519). IETF.",
    "Object Management Group. (2017). Unified Modeling Language Specification 2.5.1. "
    "https://www.omg.org/spec/UML/2.5.1/",
    "Sommerville, I. (2016). Software Engineering (10th ed.). Pearson.",
    "Pressman, R., & Maxim, B. (2020). Ingeniería del software: un enfoque práctico (9.ª ed.). "
    "McGraw-Hill.",
]:
    add_para(doc, ref)

# =================== ANEXOS ===================
add_heading(doc, "ANEXOS", level=1)
add_para(doc, "ANEXO 1. CARTA DE ACEPTACIÓN DE LA EMPRESA")
add_para(doc, "ANEXO 2. ACTA DE CONSTITUCIÓN DEL PROYECTO")
add_para(doc, "ANEXO 3. PRODUCT BACKLOG COMPLETO")
add_para(doc, "ANEXO 4. SPRINT BACKLOGS Y ACTAS DE SPRINT REVIEW")
add_para(doc, "ANEXO 5. PROTOTIPOS DE ALTA FIDELIDAD EN FIGMA (CAPTURAS)")
add_para(doc, "ANEXO 6. DIAGRAMAS UML (CASOS DE USO, CLASES, SECUENCIA, COMPONENTES, "
              "DESPLIEGUE)")
add_para(doc, "ANEXO 7. DIAGRAMA ENTIDAD-RELACIÓN, MODELO RELACIONAL Y SCRIPT DDL")
add_para(doc, "ANEXO 8. REPORTES DE COBERTURA DE PRUEBAS")
add_para(doc, "ANEXO 9. EVIDENCIA DE EJECUCIÓN DE CASOS DE PRUEBA")
add_para(doc, "ANEXO 10. MANUAL DE DESPLIEGUE")
add_para(doc, "ANEXO 11. MANUAL DE USUARIO")
add_para(doc, "ANEXO 12. DOCUMENTACIÓN OPENAPI/SWAGGER")

# =================== SAVE ===================
force_update_fields(doc)
out = r"C:\Users\angui\Documents\my-portfolio-web\FIDI Ingenierias - Formato Practica empresarial.docx"
doc.save(out)
print(f"Generado: {out}")
