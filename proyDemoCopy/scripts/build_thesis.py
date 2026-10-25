"""
Build updated thesis docx for ProyDemo y NeuroEdu IA. APA 7 formatting (Times New Roman 12, double spacing, 2.54cm margins) Auto TOC y Table of Figures y Table of Tables (Word fields) Numbered headings, SEQ-numbered captions Integrates DB design, UML, Figma prototypes, AI Agent, SCRUM
"""
import os
from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement


SRC = r"C:\Users\angui\Documents\proyDemo\FORMATO PARA ENTREGA DE DOCUMENTO FINAL 2024 3 ent.docx"
OUT = r"C:\Users\angui\Documents\proyDemo\FORMATO PARA ENTREGA DE DOCUMENTO FINAL 2024 3 ent_v4.docx"

doc = Document()

# ============================================================
# APA 7 PAGE y STYLE SETUP
# ============================================================
for section in doc.sections:
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

styles = doc.styles

# Normal: Calibri 11pt, line spacing 1.15, no first-line indent
normal = styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.paragraph_format.line_spacing = 1.15
normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
normal.paragraph_format.space_after = Pt(8)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.first_line_indent = Cm(0)

# Heading styles
def style_heading(name, size, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, italic=False):
    s = styles[name]
    s.font.name = 'Calibri'
    s.font.size = Pt(size)
    s.font.bold = bold
    s.font.italic = italic
    s.font.color.rgb = RGBColor(0, 0, 0)
    s.paragraph_format.alignment = align
    s.paragraph_format.line_spacing = 1.15
    s.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    s.paragraph_format.space_before = Pt(12)
    s.paragraph_format.space_after = Pt(6)

style_heading('Heading 1', 16, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
style_heading('Heading 2', 13, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
style_heading('Heading 3', 12, bold=True, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT)

# Ensure 'Caption' built-in style exists
try:
    caption_style = styles['Caption']
except KeyError:
    caption_style = styles.add_style('Caption', WD_STYLE_TYPE.PARAGRAPH)
caption_style.font.name = 'Calibri'
caption_style.font.size = Pt(10)
caption_style.font.italic = True
caption_style.paragraph_format.line_spacing = 1.0
caption_style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
caption_style.paragraph_format.space_after = Pt(6)
caption_style.paragraph_format.first_line_indent = Cm(0)

# Force Word to recalc TOC y TOF y SEQ fields when opening the document
settings_el = doc.settings.element
update_fields = OxmlElement('w:updateFields')
update_fields.set(qn('w:val'), 'true')
settings_el.append(update_fields)


# ============================================================
# HELPERS
# ============================================================
def add_field(paragraph, field_code):
    """Insert a Word complex field (e.g. TOC, SEQ) into a paragraph."""
    run = paragraph.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    run._r.append(fldChar1)

    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = ' ' + field_code + ' '
    run._r.append(instrText)

    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldChar2)

    placeholder = OxmlElement('w:t')
    placeholder.text = ''
    run._r.append(placeholder)

    fldChar3 = OxmlElement('w:fldChar')
    fldChar3.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar3)


def add_seq(paragraph, label):
    """Insert SEQ field for caption numbering (e.g. SEQ Tabla \* ARABIC)."""
    run = paragraph.add_run()
    for tag, attrs in [('w:fldChar', {'w:fldCharType': 'begin'}),
                       ('w:instrText', {'xml:space': 'preserve'}),
                       ('w:fldChar', {'w:fldCharType': 'separate'}),
                       ('w:t', {}),
                       ('w:fldChar', {'w:fldCharType': 'end'})]:
        el = OxmlElement(tag)
        for k, v in attrs.items():
            el.set(qn(k), v)
        if tag == 'w:instrText':
            el.text = f' SEQ {label} \\* ARABIC '
        elif tag == 'w:t':
            el.text = '1'
        run._r.append(el)


def p(text, style='Normal', align=None, bold=False, italic=False, indent=False):
    para = doc.add_paragraph(style=style)
    if align is not None:
        para.alignment = align
    para.paragraph_format.first_line_indent = Cm(0)
    para.paragraph_format.space_after = Pt(6)
    if text:
        run = para.add_run(text)
        run.bold = bold
        run.italic = italic
    return para


def h1(text):
    para = doc.add_paragraph(style='Heading 1')
    para.add_run(text.upper())
    return para


def h2(text):
    para = doc.add_paragraph(style='Heading 2')
    para.add_run(text)
    return para


def h3(text):
    para = doc.add_paragraph(style='Heading 3')
    para.add_run(text)
    return para


def page_break():
    doc.add_page_break()


def caption(label, text, before=True):
    """Add caption: e.g. 'Tabla 1. Requerimientos funcionales' or 'Figura 1. ...'.
    Word will auto-update SEQ on open. Uses built-in 'Caption' style so TOC \\c picks it up."""
    try:
        para = doc.add_paragraph(style='Caption')
    except KeyError:
        para = doc.add_paragraph()
    para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    para.paragraph_format.space_after = Pt(6)
    para.paragraph_format.first_line_indent = Cm(0)
    run = para.add_run(f'{label} ')
    run.bold = True
    run.italic = False
    add_seq(para, label)
    run2 = para.add_run(f'. {text}')
    run2.italic = True
    return para


def bullet(text):
    para = doc.add_paragraph(style='List Bullet')
    para.add_run(text)
    return para


def numbered(text):
    para = doc.add_paragraph(style='List Number')
    para.add_run(text)
    return para


def table_with_header(headers, rows, caption_text=None):
    """Place caption ABOVE table (APA 7), then build table."""
    if caption_text:
        caption('Tabla', caption_text)
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = 'Light Grid Accent 1'
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        para = hdr[i].paragraphs[0]
        run = para.add_run(h)
        run.bold = True
        run.font.size = Pt(11)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.rows[ri+1].cells[ci]
            cell.text = ''
            run = cell.paragraphs[0].add_run(str(val))
            run.font.size = Pt(11)
    # Tighten spacing
    for row in t.rows:
        for cell in row.cells:
            for para in cell.paragraphs:
                para.paragraph_format.space_after = Pt(2)
                para.paragraph_format.space_before = Pt(2)
                para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    return t


def figure_placeholder(caption_text):
    """Placeholder centered text + caption below (APA 7 figure)."""
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = para.add_run('[Insertar diagrama y prototipo aquí]')
    r.italic = True
    para_c = doc.add_paragraph()
    para_c.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    para_c.paragraph_format.space_after = Pt(6)
    run = para_c.add_run('Figura ')
    run.bold = True
    add_seq(para_c, 'Figura')
    run2 = para_c.add_run(f'. {caption_text}')
    run2.italic = True


# ============================================================
# PORTADA
# ============================================================
for _ in range(2):
    doc.add_paragraph()

p('INSTITUCIÓN UNIVERSITARIA', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
p('FACULTAD DE INGENIERÍA DE SISTEMAS', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)

for _ in range(3):
    doc.add_paragraph()

p('Desarrollo de un Sistema de Evaluación Digital Basado en Microservicios e Inteligencia Artificial Aplicada a la Neuroeducación',
  align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)

for _ in range(3):
    doc.add_paragraph()

p('PRESENTA:', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
p('Jaime Tarifa', align=WD_ALIGN_PARAGRAPH.CENTER)

doc.add_paragraph()
p('ASESOR:', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
p('[Nombre del Asesor]', align=WD_ALIGN_PARAGRAPH.CENTER)

for _ in range(3):
    doc.add_paragraph()

p('Junio 2026', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)

page_break()

# ============================================================
# ÍNDICE GENERAL (Word TOC field: auto)
# ============================================================
p('ÍNDICE GENERAL', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
toc_para = doc.add_paragraph()
add_field(toc_para, 'TOC \\o "1-3" \\h \\z \\u')
note = doc.add_paragraph()
note.alignment = WD_ALIGN_PARAGRAPH.CENTER
nr = note.add_run('(Actualizar índice en Word: clic derecho → Actualizar campos)')
nr.italic = True
nr.font.size = Pt(10)

page_break()

# ============================================================
# ÍNDICE DE TABLAS
# ============================================================
p('ÍNDICE DE TABLAS', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
tot = doc.add_paragraph()
add_field(tot, 'TOC \\h \\z \\c "Tabla"')

page_break()

# ============================================================
# ÍNDICE DE FIGURAS
# ============================================================
p('ÍNDICE DE FIGURAS', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True)
tof = doc.add_paragraph()
add_field(tof, 'TOC \\h \\z \\c "Figura"')

page_break()

# ============================================================
# 1. RESUMEN
# ============================================================
h1('Resumen')
p('Este informe documenta el proceso de diseño, planeación e implementación del módulo de evaluación inteligente de un aplicativo neuroeducativo, desarrollado en el marco de la práctica empresarial. El sistema, denominado NeuroEdu IA y ProyDemo, se construyó bajo una arquitectura de microservicios que integra NestJS como backend central de lógica de negocio, FastAPI como microservicio especializado en inteligencia artificial, Next.js como capa de presentación y PostgreSQL como motor de persistencia.', indent=True)

p('El trabajo aborda el problema de las evaluaciones estáticas y poco motivadoras presentes en las plataformas educativas tradicionales, proponiendo un módulo que combina la calificación automática de respuestas abiertas mediante procesamiento de lenguaje natural, la generación de retroalimentación personalizada por parte de un agente de IA y la recomendación adaptativa de temas pedagógicos basada en el desempeño del estudiante.', indent=True)

p('La práctica se ejecutó bajo el marco ágil Scrum, en cuatro sprints comprendidos entre el 11 de marzo y el 30 de mayo de 2026, abarcando las fases de identificación del problema, diseño, prueba piloto, modelado técnico, desarrollo, integración y pruebas funcionales. Como entregables se obtuvieron: el módulo de gestión de acceso con autenticación JWT y OAuth (Google y Microsoft); el módulo de creación, respuesta y calificación de evaluaciones; el agente de asistencia IA con retroalimentación contextualizada; los diagramas UML del sistema; los prototipos de interfaz validados en Figma y la documentación técnica completa.', indent=True)

p('Palabras clave: ', indent=True, italic=True)
last = doc.paragraphs[-1]
last.add_run('neuroeducación, inteligencia artificial, microservicios, evaluación adaptativa, Next.js, FastAPI, NestJS, PostgreSQL, API Gateway, JWT, Scrum, procesamiento de lenguaje natural, agente IA, OAuth 2.0.')

page_break()

# ============================================================
# 2. INTRODUCCIÓN
# ============================================================
h1('Introducción')

p('La práctica empresarial se desarrolló en el contexto de un aplicativo neuroeducativo, orientado a potenciar los procesos de aprendizaje mediante herramientas digitales adaptativas. El proyecto surge ante la necesidad de transformar las evaluaciones tradicionales ,generalmente estáticas, descontextualizadas y con escaso valor pedagógico para el estudiante, en un proceso de crecimiento continuo apoyado en inteligencia artificial. Esta transformación permite a la organización posicionarse a la vanguardia de la neuroeducación, integrando descubrimientos de la neurociencia cognitiva con técnicas modernas de aprendizaje automático.', indent=True)

h2('Motivación y Problemática')
p('Las plataformas educativas convencionales presentan evaluaciones que no se adaptan al ritmo ni al estilo cognitivo del estudiante, generan retroalimentación tardía o inexistente, y rara vez ofrecen un seguimiento longitudinal del progreso. Esta carencia limita el aprendizaje significativo y dificulta la labor del docente, quien debe calificar manualmente grandes volúmenes de respuestas.', indent=True)

h2('Justificación')
p('El desarrollo de un módulo de evaluación basado en microservicios e IA responde a tres necesidades: escalabilidad técnica, permitiendo que cada componente del sistema evolucione de forma independiente; personalización pedagógica, mediante recomendaciones y feedback adaptados al perfil del estudiante; y trazabilidad de los datos, garantizando que la información generada pueda alimentar futuros componentes analíticos.', indent=True)

h2('Descripción de la Empresa')
p('La empresa donde se llevó a cabo la práctica es una organización dedicada a la innovación educativa, conformada por profesionales que trabajan en el apoyo a comunidades en situación de vulnerabilidad mediante estrategias basadas en la neurociencia, la psicología cognitiva y la tecnología. Su misión es democratizar el acceso a herramientas pedagógicas avanzadas.', indent=True)

h2('Alcance')
p('Por razones de confidencialidad y tiempos de ejecución, el proyecto se enfoca específicamente en el módulo de gestión de acceso, el módulo de evaluación (creación, respuesta y calificación), el agente de retroalimentación IA y la capa de recomendación de temas. El alcance incluye la arquitectura, la lógica de negocio, el modelo de datos, los prototipos de interfaz y la documentación técnica. Quedan fuera del alcance los módulos de gamificación avanzada, los 18 ejes globales de la plataforma matriz y la integración con sistemas LMS externos.', indent=True)

h2('Objetivos')
h3('Objetivo General')
p('Diseñar e implementar un módulo de evaluación inteligente, soportado por una arquitectura de microservicios con inteligencia artificial, que permita la creación, calificación y retroalimentación adaptativa de pruebas dentro de un aplicativo neuroeducativo.', indent=True)

h3('Objetivos Específicos')
bullet('Crear un prototipo funcional del módulo de pruebas que utilice inteligencia artificial para recomendar temas pedagógicos.')
bullet('Diseñar una arquitectura escalable basada en microservicios utilizando NestJS y FastAPI.')
bullet('Crear prototipos de interfaz centrados en la experiencia de interacción con el agente de asistencia IA.')
bullet('Documentar la estructura y funcionamiento del sistema mediante el modelo entidad-relación y los diagramas UML estandarizados.')
bullet('Implementar el módulo de autenticación y autorización con soporte para JWT y OAuth 2.0 (Google y Microsoft).')
bullet('Validar el cumplimiento de los requerimientos funcionales y no funcionales mediante un plan de pruebas integral.')

page_break()

# ============================================================
# 3. REVISIÓN DE LITERATURA
# ============================================================
h1('Revisión de Literatura y Antecedentes')

p('La solución propuesta se fundamenta en la convergencia entre la inteligencia artificial y las ciencias cognitivas, enmarcada en lo que la literatura actual describe como los tres paradigmas de la IA en educación: IA dirigida (orientada a tareas específicas), IA generativa (asistencia y creación de contenido) e IA agéntica (autónoma y orientada a objetivos). Ouyang y Jiao (2021) sostienen que la transición progresiva entre estos paradigmas redefine el rol del docente, del estudiante y de los entornos digitales de aprendizaje.', indent=True)

p('Desde la perspectiva neuroeducativa, estudios recientes subrayan que la integración de sistemas inteligentes puede optimizar los procesos de enseñanza-aprendizaje, alineándose con los patrones de adquisición del conocimiento descritos por la neurociencia cognitiva (Burbano-Enríquez et al., 2025). En la primera infancia, estos sistemas favorecen el desarrollo de capacidades metacognitivas mediante retroalimentación inmediata y adaptativa.', indent=True)

p('La transición hacia agentes de IA autónomos ,descrita por Belcic y Stryker (2025), representa un avance significativo respecto a los bots estáticos, permitiendo una personalización dinámica que se ajusta al contexto, al historial y al estilo de aprendizaje del usuario. Jin et al. (2026) muestran que los modelos de lenguaje a gran escala producen ganancias cognitivas medibles, aunque también revelan brechas afectivas que deben atenderse mediante diseño pedagógico cuidadoso.', indent=True)

p('Finalmente, los antecedentes en tecnologías educativas indican que el futuro se orienta hacia entornos híbridos y escalables (Zhang & Aslan, 2021), en los que los microservicios, la nube y el aprendizaje automático conviven para sostener experiencias educativas personalizadas. Por lo tanto, el desarrollo del presente módulo de evaluación inteligente se inscribe en esta corriente y aporta una solución concreta al problema descrito.', indent=True)

page_break()

# ============================================================
# 4. MARCO TEÓRICO
# ============================================================
h1('Marco Teórico')

h2('Neuroeducación')
p('La neuroeducación es un campo interdisciplinario que combina los descubrimientos de la neurociencia cognitiva con la teoría y la práctica educativa, con el fin de mejorar los procesos de enseñanza y aprendizaje. Caballero y Llorent (2022) realizaron un estudio cuasi experimental en el que mostraron que las intervenciones basadas en principios neuroeducativos producen mejoras significativas en la atención sostenida y en el rendimiento académico. En contextos clínicos, los aportes de la neuroeducación también se han extendido a la simulación y la toma de decisiones durante las prácticas profesionales.', indent=True)

h2('Arquitectura de Microservicios')
p('La arquitectura de microservicios organiza una aplicación como un conjunto de servicios pequeños y autónomos, débilmente acoplados, que pueden desplegarse de forma independiente. Li et al. (2021) revisaron 72 estudios primarios y resumieron atributos de calidad como escalabilidad, mantenibilidad y resiliencia. Waseem, Liang y Shahin (2021) reportan que la combinación de Domain Driven Design con prácticas de monitoreo continuo facilita el diseño y la evolución de estos sistemas. La evolución de las APIs entre microservicios constituye uno de los principales desafíos, ya que requiere mantener compatibilidad sin frenar la entrega continua.', indent=True)

h2('API Gateway')
p('El API Gateway actúa como punto único de entrada hacia los microservicios. Maneja aspectos transversales como autenticación, autorización, enrutamiento, transformación de datos, rate limiting y telemetría. Investigaciones recientes proponen estrategias de seguridad que integran tokens JWT, OAuth 2.0 y mecanismos de mTLS para asegurar la comunicación entre el gateway y los servicios internos.', indent=True)

h2('Next.js y TailwindCSS')
p('Next.js es un framework basado en React que ofrece renderizado del lado del servidor, generación estática, enrutamiento basado en el sistema de archivos y optimización automática de recursos. TailwindCSS aporta utilidades CSS atómicas que permiten construir interfaces consistentes y mantenibles. La combinación de ambos habilita interfaces accesibles, rápidas y alineadas con métricas Core Web Vitals.', indent=True)

h2('NestJS')
p('NestJS es un framework de Node.js construido sobre TypeScript, modular, con inyección de dependencias nativa y una clara separación entre controladores, servicios y repositorios. Su arquitectura favorece la aplicación de los principios SOLID y la implementación de patrones como Hexagonal y Clean Architecture, lo cual resulta especialmente adecuado para sistemas empresariales escalables.', indent=True)

h2('FastAPI')
p('FastAPI es un framework de Python de alto rendimiento basado en ASGI, que aprovecha type hints y Pydantic para validación de datos, y genera documentación automática mediante OpenAPI. Resulta ideal para microservicios analíticos, de procesamiento de lenguaje natural y de inferencia de modelos de aprendizaje automático, debido a su soporte nativo de asincronía.', indent=True)

h2('PostgreSQL')
p('PostgreSQL es un sistema gestor de bases de datos relacional, de código abierto, que cumple con el estándar ACID. Ofrece soporte para tipos JSONB, índices GIN y GiST, particionamiento, vistas materializadas y un conjunto amplio de extensiones, lo que permite manejar tanto datos estructurados como semi-estructurados con eficiencia.', indent=True)

h2('JSON Web Tokens')
p('JWT es un estándar abierto que define una forma compacta y segura de transmitir información firmada entre dos partes. Resulta adecuado para autenticación sin estado en arquitecturas de microservicios, dado que cada servicio puede validar el token sin necesidad de consultar una sesión centralizada.', indent=True)

h2('OAuth 2.0 y OpenID Connect')
p('OAuth 2.0 es un protocolo de autorización delegada que permite a una aplicación obtener acceso limitado a recursos de un usuario sin manejar sus credenciales directamente. OpenID Connect extiende OAuth 2.0 con una capa de identidad mediante el id_token. En el proyecto, ambos se utilizan para integrar el inicio de sesión con Google Identity y Microsoft Entra ID.', indent=True)

h2('Scrum')
p('Scrum es un marco de trabajo ágil basado en un enfoque iterativo e incremental. Define roles (Product Owner, Scrum Master y Equipo de Desarrollo), eventos (Sprint, Sprint Planning, Daily, Sprint Review, Retrospectiva) y artefactos (Product Backlog, Sprint Backlog, Incremento). La literatura reciente destaca su efectividad al combinarse con prácticas de integración y pruebas continuas.', indent=True)

h2('UML')
p('El Lenguaje de Modelado Unificado (UML) es un lenguaje gráfico estandarizado por el Object Management Group que permite especificar, visualizar y documentar los artefactos de un sistema de software. En este proyecto se emplean diagramas de casos de uso, de clases, de secuencia, de estados, de componentes y de despliegue, junto con el modelo entidad-relación para la base de datos.', indent=True)

page_break()

# ============================================================
# 5. ESTADO DEL ARTE Y REQUERIMIENTOS
# ============================================================
h1('Estado del Arte y Levantamiento de Requerimientos')

h2('Proceso de Levantamiento de Requerimientos')
p('El levantamiento de requerimientos se llevó a cabo durante la Fase 1 del proyecto, comprendida entre el 11 de marzo y el 6 de abril de 2026. Para ello se emplearon varias técnicas complementarias:', indent=True)

bullet('Entrevistas estructuradas con los stakeholders y la dirección de la organización, orientadas a identificar las necesidades pedagógicas, las limitaciones de los sistemas actuales y las prioridades funcionales.')
bullet('Análisis comparativo de plataformas EdTech, examinando las funcionalidades de evaluación de cinco soluciones de referencia: Google Classroom, classroom.io, Moodle, Kahoot y Quizizz.')
bullet('Revisión de literatura científica en neuroeducación y sistemas de evaluación inteligente, con el fin de alinear los requerimientos con las tendencias más recientes en aprendizaje personalizado y retroalimentación adaptativa.')

h2('Requerimientos Funcionales')
rf = [
    ['1', 'Acceso', 'El sistema debe permitir que los nuevos usuarios se registren mediante correo electrónico y contraseña.'],
    ['2', 'Acceso', 'El sistema debe autenticar a los usuarios mediante tokens JWT con rotación de refresh tokens.'],
    ['3', 'Acceso', 'El sistema debe implementar un control de acceso basado en roles (USER, TEACHER, ADMIN).'],
    ['4', 'Acceso', 'El sistema debe permitir el inicio de sesión a través de proveedores OAuth 2.0 (Google y Microsoft).'],
    ['5', 'Evaluación', 'El docente debe poder crear evaluaciones con preguntas de opción múltiple, verdadero/falso y respuesta abierta.'],
    ['6', 'Evaluación', 'El sistema debe permitir al docente generar evaluaciones automáticamente mediante el agente IA, indicando tema, dificultad y número de preguntas.'],
    ['7', 'Evaluación', 'El sistema debe permitir al docente publicar, despublicar y editar las evaluaciones creadas.'],
    ['8', 'Evaluación', 'El estudiante debe poder listar las evaluaciones publicadas y filtrarlas por categoría e idioma.'],
    ['9', 'Evaluación', 'El estudiante debe poder iniciar una sesión de quiz, responder preguntas con cronómetro y completar la evaluación.'],
    ['10', 'IA', 'El sistema debe calificar automáticamente las respuestas objetivas y las respuestas abiertas, utilizando el microservicio FastAPI.'],
    ['11', 'IA', 'El agente IA debe generar retroalimentación personalizada para cada estudiante, en menos de 15 segundos.'],
    ['12', 'Score', 'El sistema debe almacenar el puntaje, la precisión y el historial de cada sesión de quiz.'],
    ['13', 'Score', 'El sistema debe ofrecer un leaderboard global y un panel de progreso individual.'],
    ['14', 'Notificación', 'El sistema debe notificar al estudiante en tiempo real (WebSocket) los logros desbloqueados.'],
    ['15', 'Administración', 'El administrador debe poder gestionar usuarios y consultar analíticas globales.'],
]
table_with_header(['N°', 'Módulo', 'Requerimiento Funcional'], rf,
                  caption_text='Requerimientos funcionales del sistema NeuroEdu IA.')

h2('Requerimientos No Funcionales')
rnf = [
    ['1', 'Seguridad', 'Las contraseñas de los usuarios deben almacenarse utilizando bcrypt con factor de costo mínimo de 12.'],
    ['2', 'Rendimiento', 'El agente IA debe generar retroalimentación en un tiempo medio inferior a 15 segundos.'],
    ['3', 'Escalabilidad', 'La arquitectura basada en microservicios debe permitir que cada servicio escale de forma independiente.'],
    ['4', 'Usabilidad', 'La interfaz del sistema debe ser fácil de usar y permitir el uso en dispositivos móviles y de escritorio.'],
    ['5', 'Accesibilidad', 'La interfaz debe cumplir el estándar WCAG 2.1 nivel AA.'],
    ['6', 'Disponibilidad', 'El sistema debe garantizar una disponibilidad mínima del 99.0 % en horario operativo.'],
    ['7', 'Trazabilidad', 'Todas las acciones críticas (inicio de sesión, calificación, generación IA) deben quedar registradas en auditoría.'],
]
table_with_header(['N°', 'Categoría', 'Requerimiento No Funcional'], rnf,
                  caption_text='Requerimientos no funcionales del sistema NeuroEdu IA.')

h2('Historias de Usuario')
p('Las historias de usuario siguen la estructura estándar de la metodología Scrum, en la que se detalla el rol del usuario, la funcionalidad requerida y el valor que aporta al negocio. A continuación se presenta el Product Backlog priorizado.', indent=True)

hu = [
    ['1', 'Como estudiante, me gustaría registrarme usando mi correo electrónico y contraseña.', '3', 'Alta', 'Sprint 1'],
    ['2', 'Como estudiante, quiero poder iniciar sesión con mis credenciales para acceder a mis evaluaciones.', '3', 'Alta', 'Sprint 1'],
    ['3', 'Como estudiante, deseo iniciar sesión con mi cuenta de Google o Microsoft.', '2', 'Media', 'Sprint 1'],
    ['4', 'Como docente, quiero crear evaluaciones con preguntas de varios tipos para mis estudiantes.', '8', 'Alta', 'Sprint 2'],
    ['5', 'Como docente, quiero generar una evaluación automáticamente con IA indicando tema y dificultad.', '8', 'Alta', 'Sprint 2'],
    ['6', 'Como docente, quiero publicar y despublicar evaluaciones según mi plan de clase.', '3', 'Media', 'Sprint 2'],
    ['7', 'Como estudiante, quiero listar las evaluaciones publicadas y filtrarlas por categoría.', '3', 'Alta', 'Sprint 2'],
    ['8', 'Como estudiante, quiero responder un quiz con cronómetro y ver mi puntaje al finalizar.', '8', 'Alta', 'Sprint 2'],
    ['9', 'Como estudiante, quiero recibir retroalimentación personalizada del agente IA.', '13', 'Alta', 'Sprint 3'],
    ['10', 'Como docente, quiero ver los resultados de mis estudiantes en un panel.', '5', 'Alta', 'Sprint 3'],
    ['11', 'Como estudiante, quiero recibir una notificación cuando desbloquee un logro.', '3', 'Media', 'Sprint 3'],
    ['12', 'Como administrador, quiero gestionar usuarios y ver analíticas globales.', '5', 'Media', 'Sprint 3'],
]
table_with_header(['#', 'Historia de Usuario', 'Story Points', 'Prioridad', 'Sprint'], hu,
                  caption_text='Product Backlog priorizado del proyecto.')

h2('Historias de Usuario Detalladas')

h3('HU-01: Registro de Usuario')
hu1 = [
    ['Historia', 'Como estudiante, me gustaría registrarme usando mi correo electrónico y contraseña para acceder a la plataforma.'],
    ['Criterios de aceptación', '• El correo debe ser único en el sistema; si ya existe, debe mostrarse un mensaje claro.\n• La contraseña debe cumplir reglas de complejidad (mínimo 8 caracteres, letras y números).\n• La contraseña se almacena con bcrypt, factor 12.\n• Al registrarse, el usuario recibe un correo de verificación.'],
    ['Story Points', '3'],
    ['Prioridad', 'Alta'],
    ['Sprint', 'Sprint 1'],
    ['Estado', 'Completada'],
]
table_with_header(['Campo', 'Detalle'], hu1, caption_text='Historia de usuario HU-01: Registro de usuario.')

h3('HU-04: Creación de Evaluación por Docente')
hu4 = [
    ['Historia', 'Como docente, quiero crear una evaluación que incluya preguntas de opción múltiple, verdadero/falso y respuesta abierta.'],
    ['Criterios de aceptación', '• El formulario permite añadir preguntas de los tres tipos soportados.\n• Cada pregunta puede tener un tiempo límite individual.\n• La evaluación se guarda en estado borrador hasta su publicación explícita.\n• Validación con Zod en el cliente y class-validator en NestJS.'],
    ['Story Points', '8'],
    ['Prioridad', 'Alta'],
    ['Sprint', 'Sprint 2'],
    ['Estado', 'Completada'],
]
table_with_header(['Campo', 'Detalle'], hu4, caption_text='Historia de usuario HU-04: Creación de evaluación por docente.')

h3('HU-09: Retroalimentación Personalizada del Agente IA')
hu9 = [
    ['Historia', 'Como estudiante, deseo recibir retroalimentación personalizada del agente IA al terminar una evaluación.'],
    ['Criterios de aceptación', '• La retroalimentación debe generarse en menos de 15 segundos.\n• Debe identificar las áreas con menor desempeño y recomendar temas de estudio.\n• Debe mantener un tono motivador y centrado en el crecimiento.\n• El feedback se persiste en la base de datos para análisis longitudinal.'],
    ['Story Points', '13'],
    ['Prioridad', 'Alta'],
    ['Sprint', 'Sprint 3'],
    ['Estado', 'Completada'],
]
table_with_header(['Campo', 'Detalle'], hu9, caption_text='Historia de usuario HU-09: Retroalimentación personalizada del agente IA.')

h3('HU-10: Resultados para Docente')
hu10 = [
    ['Historia', 'Como docente, quiero ver los resultados de mis estudiantes para tomar decisiones pedagógicas.'],
    ['Criterios de aceptación', '• El panel muestra la lista de estudiantes con su nota, tiempo invertido y precisión.\n• Se puede filtrar por evaluación, categoría y rango de fechas.\n• Se incluyen gráficos de distribución de notas y de progreso por estudiante.'],
    ['Story Points', '5'],
    ['Prioridad', 'Alta'],
    ['Sprint', 'Sprint 3'],
    ['Estado', 'Completada'],
]
table_with_header(['Campo', 'Detalle'], hu10, caption_text='Historia de usuario HU-10: Resultados para docente.')

page_break()

# ============================================================
# 6. DISEÑO DE BASE DE DATOS Y DIAGRAMAS UML
# ============================================================
h1('Diseño de Base de Datos y Diagramas UML')

p('Esta sección presenta la documentación gráfica completa del sistema. Los diagramas se elaboraron en formato PlantUML (extensión .puml) y se exportaron como imágenes de alta resolución. Los modelos cubren los módulos de Gestión de Acceso, Evaluación, Calificación, Retroalimentación y Notificaciones, así como la totalidad del esquema de persistencia.', indent=True)

h2('Proceso de Diseño')
p('El diseño de la base de datos se desarrolló bajo el proceso formal de modelado en tres niveles: modelo conceptual mediante el diagrama Entidad Relacion; modelo lógico mediante el modelo relacional normalizado; y modelo físico implementado en PostgreSQL 18 con TypeORM. Cada nivel fue validado contra las historias de usuario y los requerimientos funcionales.', indent=True)

h2('Modelo Entidad Relacion')
p('El modelo Entidad Relacion identifica las entidades fundamentales del dominio, sus atributos y las relaciones que se establecen entre ellas. El sistema contempla ocho entidades principales: users, auth_sessions, quizzes, questions, quiz_sessions, scores, achievements y notifications.', indent=True)

figure_placeholder('Diagrama Entidad Relacion del sistema NeuroEdu IA (notación Crow\'s Foot). Fuente: diagrams/01_ER_DER.puml.')

ent = [
    ['users', 'Usuarios registrados', 'id (PK), email (UK), password_hash, first_name, last_name, role [USER|TEACHER|ADMIN], is_active, is_email_verified, created_at, updated_at'],
    ['auth_sessions', 'Sesiones de autenticación (refresh tokens activos)', 'id (PK), user_id (FK), refresh_token_hash, user_agent, ip_address, expires_at, is_revoked, created_at'],
    ['quizzes', 'Evaluaciones creadas por docentes o por IA', 'id (PK), author_id (FK), title, description, category, difficulty [EASY|MEDIUM|HARD], language, source, time_per_question_seconds, is_published, created_at, updated_at'],
    ['questions', 'Preguntas asociadas a un quiz', 'id (PK), quiz_id (FK ON DELETE CASCADE), text, type [MC|TF|OPEN], options (JSONB), correct_answer, difficulty, language, position, time_limit_seconds'],
    ['quiz_sessions', 'Sesiones de juego de un estudiante sobre un quiz', 'id (PK), user_id (FK), quiz_id (FK), status [IN_PROGRESS|COMPLETED|ABANDONED], answers (JSONB), total_score, correct_count, started_at, completed_at'],
    ['scores', 'Resultados finales de una sesión completada', 'id (PK), user_id (FK), quiz_id (FK), session_id (FK), points, correct_count, total_questions, accuracy, created_at'],
    ['achievements', 'Logros desbloqueados por el usuario', 'id (PK), user_id (FK), code, title, description, unlocked_at: UK (user_id, code)'],
    ['notifications', 'Notificaciones entregadas al usuario', 'id (PK), user_id (FK), type, title, body, is_read, read_at, created_at'],
]
table_with_header(['Entidad', 'Propósito', 'Atributos principales'], ent,
                  caption_text='Entidades del modelo de datos y sus atributos principales.')

p('Las cardinalidades se establecen de la siguiente forma: un usuario puede tener múltiples sesiones de autenticación, múltiples quizzes creados (como autor), múltiples sesiones de juego, múltiples puntajes, múltiples logros y múltiples notificaciones. Un quiz contiene una o más preguntas (composición), y cada sesión de quiz genera exactamente un score al completarse.', indent=True)

h2('Modelo Relacional Físico')
p('El modelo relacional físico, expresado en notación IDEF1X y compatible con SQL DDL estándar, se implementa sobre PostgreSQL 18. Se definieron claves primarias UUID, claves foráneas con políticas ON DELETE CASCADE donde corresponde, índices secundarios sobre columnas filtrables (email, author_id, category, is_published, language, user_id, status, created_at) y restricciones de unicidad compuesta sobre achievements(user_id, code).', indent=True)

figure_placeholder('Modelo relacional físico: esquema PostgreSQL. Fuente: diagrams/02_Modelo_Relacional.puml.')

idx = [
    ['users', 'uq_users_email (UNIQUE) sobre email', 'Búsqueda en login y validación de unicidad.'],
    ['auth_sessions', 'idx_sessions_user sobre user_id', 'Listar sesiones activas por usuario y revocación masiva.'],
    ['quizzes', 'idx_quizzes_author, idx_quizzes_category, idx_quizzes_published, idx_quizzes_language', 'Soporte a filtros frecuentes del catálogo.'],
    ['questions', 'idx_questions_quiz sobre quiz_id', 'Carga eficiente de preguntas al iniciar sesión.'],
    ['quiz_sessions', 'idx_qsessions_user, idx_qsessions_quiz, idx_qsessions_status', 'Histórico y panel de actividad por usuario y docente.'],
    ['scores', 'idx_scores_user, idx_scores_quiz, idx_scores_created', 'Leaderboard, progreso individual y series temporales.'],
    ['achievements', 'uq_ach_user_code (UNIQUE), idx_ach_user', 'Evita duplicados y soporta consulta de logros del usuario.'],
    ['notifications', 'idx_notif_user, idx_notif_unread (user_id, is_read)', 'Bandeja del usuario y badge de no leídas.'],
]
table_with_header(['Tabla', 'Índices', 'Justificación'], idx,
                  caption_text='Índices del esquema físico y su justificación.')

h2('Análisis de Normalización')
p('El esquema se validó bajo las formas normales 1FN, 2FN, 3FN y BCNF. Todas las tablas alcanzan al menos 3FN, y la mayoría cumplen BCNF. Se documentan dos denormalizaciones controladas y justificadas:', indent=True)

bullet('quiz_sessions.answers (JSONB): se conserva un array de respuestas embebido. La sesión se lee siempre como un agregado completo, el array crece monotónicamente durante la partida y se vuelve inmutable tras la finalización. Una tabla session_answers separada añadiría un INSERT por respuesta y un SELECT N+1 al leer la sesión, sin beneficio funcional.')
bullet('scores.accuracy (FLOAT): es una derivación de correct_count y total_questions. Se persiste denormalizada porque el leaderboard se ordena directamente por accuracy y porque el score es inmutable tras su creación, eliminando el riesgo de inconsistencia.')

p('Estas decisiones se documentan en los archivos *.entity.ts y se acompañan de invariantes verificadas en la capa de aplicación antes de persistir cada registro.', indent=True)

h2('Diagrama de Clases UML')
p('El diagrama de clases representa la capa de dominio, aplicación e infraestructura del módulo de autenticación, que sirve como ejemplo canónico de la arquitectura hexagonal aplicada a todos los módulos del sistema. La capa de dominio contiene el agregado User, las entidades Session, los objetos de valor Email y TokenPair, el enumerado Role y los puertos IUserRepository, IAuthRepository, ITokenService e IOAuthVerifier. La capa de aplicación contiene los casos de uso LoginUseCase, RegisterUseCase, RefreshTokenUseCase, LogoutUseCase y OAuthLoginUseCase, junto con el DTO de respuesta AuthResponseDto. La capa de infraestructura incluye los adaptadores concretos UserRepository (TypeORM), AuthRepository (TypeORM), JwtTokenService, GoogleOAuthVerifier, MicrosoftOAuthVerifier y OAuthVerifierRegistry. La capa de presentación expone AuthController, que orquesta las operaciones del módulo.', indent=True)

figure_placeholder('Diagrama de clases UML: módulo Auth (hexagonal + clean architecture). Fuente: diagrams/04_Clases_UML.puml.')

h2('Diagrama de Casos de Uso')
p('El diagrama de casos de uso identifica cinco actores: Estudiante (USER), Docente (TEACHER), Administrador (ADMIN), Sistema OAuth externo (Google y Microsoft) y Servicio IA externo (FastAPI). Los casos de uso se agrupan en seis paquetes: Autenticación, Quiz: Jugar, Quiz: Crear, Score y Ranking, Notificaciones y Administración. El docente hereda los casos del estudiante y agrega la creación de evaluaciones; el administrador hereda los del docente y agrega la gestión global. Las relaciones <<include>> y <<extend>> conectan los casos de uso de completar quiz con la calificación IA y con el envío de notificaciones.', indent=True)

figure_placeholder('Diagrama de casos de uso del sistema NeuroEdu IA. Fuente: diagrams/05_Casos_de_Uso.puml.')

h2('Diagrama de Secuencia: Inicio de Sesión OAuth')
p('El flujo OAuth comienza cuando el usuario hace clic en "Iniciar sesión con Google" en la interfaz Next.js. La acción del servidor invoca Auth.js v5, que redirige al proveedor de identidad. Tras la autorización, Auth.js intercambia el código por un id_token, lo almacena en su sesión y redirige al endpoint puente /api/auth/oauth/bridge. El puente envía el id_token al endpoint POST /auth/oauth de NestJS, que delega al OAuthLoginUseCase. Este caso de uso invoca el verificador correspondiente (GoogleOAuthVerifier o MicrosoftOAuthVerifier), consulta la base de datos para encontrar o crear el usuario, emite un par de tokens (access + refresh) y persiste la sesión. El puente recibe la respuesta, fija las cookies httpOnly neuroedu_access y neuroedu_refresh, cierra la sesión de Auth.js y redirige al dashboard.', indent=True)

figure_placeholder('Diagrama de secuencia: inicio de sesión OAuth con Auth.js v5 + bridge a NestJS. Fuente: diagrams/06_Secuencias_OAuth.puml.')

h2('Diagrama de Secuencia: Resolución de un Quiz')
p('El estudiante abre la página del quiz; el frontend solicita los datos al endpoint GET /quiz/:id de NestJS, que devuelve el quiz junto con sus preguntas. Al iniciar, se invoca POST /quiz/:id/start, que crea una nueva quiz_session en estado IN_PROGRESS. Para cada pregunta, el cliente envía POST /quiz/session/:sid/answer; si la pregunta es de tipo MC o TF, la verificación es local y comparativa; si es OPEN, el caso de uso AnswerQuestionUseCase delega al microservicio FastAPI (POST /grade), que ejecuta la estrategia de similitud semántica y devuelve {isCorrect, score, feedback}. Al finalizar, POST /quiz/session/:sid/complete actualiza el estado a COMPLETED, calcula totalScore y accuracy, crea el registro en scores, evalúa logros y emite eventos por WebSocket a través de NotificationGateway.', indent=True)

figure_placeholder('Diagrama de secuencia: resolución de un quiz e integración con FastAPI. Fuente: diagrams/06b_Secuencias_PlayQuiz.puml.')

h2('Diagrama de Estados: QuizSession')
p('La máquina de estados de una sesión de quiz contempla los estados CREATED, IN_PROGRESS, COMPLETED y ABANDONED. La transición CREATED → IN_PROGRESS ocurre con la primera respuesta enviada. La transición IN_PROGRESS → COMPLETED se dispara con POST /complete y produce el score, la verificación de logros y la notificación por WebSocket. La transición IN_PROGRESS → ABANDONED se dispara por timeout superior a 30 minutos o por cierre explícito. Las sesiones en estado COMPLETED son inmutables y constituyen la única fuente válida para el cálculo del ranking y los logros.', indent=True)

figure_placeholder('Diagrama de estados: QuizSession. Fuente: diagrams/08_Estados_QuizSession.puml.')

h2('Diagrama de Arquitectura de Microservicios')
p('El diagrama de arquitectura muestra cuatro nodos lógicos: Frontend Tier (Next.js + Auth.js + proxy.ts), Backend Tier (NestJS con módulos Auth, Users, Quiz, Score, Notifications, AIClient y JwtAuthGuard global), AI Microservice (FastAPI con generador y calificador), y la capa de datos (PostgreSQL vía TypeORM, Redis para cache y colas Bull). El usuario accede a través del CDN/Vercel Edge; las peticiones autenticadas llegan al backend con Bearer JWT; el backend orquesta la persistencia y delega al microservicio FastAPI las operaciones de IA. La comunicación con notificaciones se establece por WebSocket Secure.', indent=True)

figure_placeholder('Diagrama de arquitectura de microservicios: vista de despliegue. Fuente: diagrams/07_Arquitectura_Microservicios.puml.')

h2('Diagrama de Componentes')
p('El diagrama de componentes refina la vista lógica de la solución completa. En el frontend se identifican los grupos Atomic Design (atoms, molecules, organisms, templates), Routes (rutas (auth) y (portal)), Server Layer (Server Actions, Route Handlers, proxy.ts) y Cross-cutting (Auth.js, lib/auth.ts BFF, lib/api-client, Redux Toolkit). En el backend NestJS se detalla el módulo Auth con su controlador, sus casos de uso, sus puertos y sus adaptadores, junto con los módulos Users, Quiz, Score, Notifications, AI Client, ConfigModule y EventEmitter2 para eventos de dominio. El microservicio FastAPI expone los endpoints /generate y /grade, que internamente consultan el LLM (OpenAI o Ollama local).', indent=True)

figure_placeholder('Diagrama de componentes del sistema NeuroEdu IA. Fuente: diagrams/09_Componentes.puml.')

page_break()

# ============================================================
# 7. PROTOTIPOS DE INTERFAZ (FIGMA)
# ============================================================
h1('Prototipos de Interfaz: Figma')

p('Los prototipos de la plataforma se diseñaron en Figma durante la Fase 2 del proyecto (6 al 24 de abril de 2026) y se validaron con la dirección académica antes de iniciar la codificación del frontend. Los prototipos cubren los flujos de aterrizaje, autenticación y los tres portales (estudiante, docente, administrador). Cada pantalla del prototipo se materializa en una ruta del directorio Demohtml y en una página del directorio Frontend (Next.js).', indent=True)

h2('Página de Aterrizaje (Landing)')
p('La página principal presenta la propuesta de valor de NeuroEdu IA mediante un hero con título degradado, llamada a la acción "Comenzar gratis", indicadores de tracción (estudiantes activos, precisión IA y evaluaciones disponibles) y un ilustrativo cerebro estilizado. Se incluyen secciones de características, roles y "cómo funciona", junto con un pie de página con datos de contacto. Esta pantalla se conecta con index.html y orienta al usuario hacia el registro o el inicio de sesión.', indent=True)
figure_placeholder('Prototipo Figma: Landing NeuroEdu IA. Fuente: Demohtml/index.html.')

h2('Pantallas de Autenticación')
p('Las pantallas de login y registro siguen un patrón centrado, con tarjeta de formulario sobre fondo degradado, soporte para inicio de sesión con Google y Microsoft (botones con logotipos), validación inline de campos, indicador de fortaleza de contraseña en registro y enlaces a recuperación de contraseña. Estas pantallas implementan la HU-01, HU-02 y HU-03 del backlog y se materializan en login.html y register.html.', indent=True)
figure_placeholder('Prototipo Figma: Iniciar sesión. Fuente: Demohtml/login.html.')
figure_placeholder('Prototipo Figma: Registro. Fuente: Demohtml/register.html.')

h2('Portal del Estudiante')
p('El portal del estudiante contiene cuatro pantallas principales:', indent=True)
bullet('Dashboard del estudiante: resumen de evaluaciones pendientes, evaluaciones completadas, racha de días y atajos rápidos. Implementa parte de la HU-08 y la HU-13.')
bullet('Listado de evaluaciones: filtros por categoría, idioma y dificultad; tarjetas con título, descripción, tiempo estimado y botón "Iniciar". Implementa la HU-08.')
bullet('Progreso: gráficos de puntos totales, precisión promedio, mejor precisión, tendencia de los últimos 20 quizzes y distribución por rangos (<40 %, 40-70 %, ≥70 %). Implementa la HU-13.')
bullet('Feedback inteligente: visualización del análisis del agente IA, áreas con menor desempeño, recomendaciones de estudio y motivación. Implementa la HU-09.')
figure_placeholder('Prototipo Figma: Dashboard del estudiante. Fuente: Demohtml/estudiante/dashboard.html.')
figure_placeholder('Prototipo Figma: Listado de evaluaciones (estudiante). Fuente: Demohtml/estudiante/examenes.html.')
figure_placeholder('Prototipo Figma: Progreso del estudiante. Fuente: Demohtml/estudiante/progreso.html.')
figure_placeholder('Prototipo Figma: Feedback del agente IA. Fuente: Demohtml/estudiante/feedback.html.')

h2('Portal del Docente')
p('El portal del docente contiene tres pantallas principales:', indent=True)
bullet('Dashboard del docente: top de estudiantes (leaderboard), rendimiento promedio por evaluación y distribución por dificultad. Implementa parte de la HU-10.')
bullet('Gestión de evaluaciones: listado, creación manual y creación asistida por IA (modal con tema, dificultad y número de preguntas). Implementa la HU-04, HU-05 y HU-06.')
bullet('Resultados detallados: tabla con estudiantes, nota, tiempo invertido y precisión; filtros por evaluación y rango de fechas. Implementa la HU-10.')
figure_placeholder('Prototipo Figma: Dashboard del docente. Fuente: Demohtml/docente/dashboard.html.')
figure_placeholder('Prototipo Figma: Gestión de evaluaciones. Fuente: Demohtml/docente/examenes.html.')
figure_placeholder('Prototipo Figma: Resultados del docente. Fuente: Demohtml/docente/resultados.html.')

h2('Portal del Administrador')
p('El portal administrativo contiene tres pantallas principales:', indent=True)
bullet('Dashboard administrativo: conteos globales por rol (estudiantes, docentes, administradores), evaluaciones publicadas, sesiones jugadas y top 10 de estudiantes. Implementa la HU-12.')
bullet('Gestión de usuarios: listado paginado, búsqueda por nombre o correo, activación/desactivación y cambio de rol. Implementa la HU-12.')
bullet('Gestión de evaluaciones a nivel global: revisión y moderación del catálogo. Implementa la HU-12.')
figure_placeholder('Prototipo Figma: Dashboard del administrador. Fuente: Demohtml/admin/dashboard.html.')
figure_placeholder('Prototipo Figma: Gestión de usuarios. Fuente: Demohtml/admin/usuarios.html.')
figure_placeholder('Prototipo Figma: Gestión global de evaluaciones. Fuente: Demohtml/admin/examenes.html.')

p('Cada prototipo respeta los principios de Atomic Design, los lineamientos de accesibilidad WCAG 2.1 AA (contraste mínimo, navegación por teclado, etiquetas ARIA) y los componentes establecidos en la biblioteca TailwindCSS del proyecto. La trazabilidad entre prototipo y código se garantiza mediante referencias explícitas a cada archivo HTML del directorio Demohtml.', indent=True)

page_break()

# ============================================================
# 8. AGENTE IA: ARQUITECTURA Y FUNCIONAMIENTO
# ============================================================
h1('Agente IA: Arquitectura y Funcionamiento')

p('El Agente IA es el componente diferencial de la plataforma. Se implementa en el microservicio FastAPI y se compone de cuatro contextos delimitados: Grading (calificación), Feedback (retroalimentación pedagógica), Assistant (agente tutor conversacional) y Analytics (análisis de dificultad y anomalías). Cada contexto sigue la arquitectura hexagonal con su propia capa de dominio, aplicación, infraestructura y presentación.', indent=True)

h2('Contexto Grading: Calificación Automática')
p('El contexto Grading expone los endpoints POST /grading/grade y POST /grading/batch. Internamente aplica el patrón Strategy para seleccionar el modelo de calificación según el tipo de pregunta:', indent=True)
bullet('ExactMatchModel: aplica a preguntas objetivas (opción múltiple y verdadero/falso). Comparación literal con la respuesta correcta.')
bullet('SimilarityModel: utiliza sentence-transformers para calcular la similitud coseno entre la respuesta del estudiante y la respuesta de referencia, devolviendo un score normalizado en el rango [0, 1].')
bullet('NlpModel: aplica un pipeline spaCy para análisis semántico complementario (lematización, reconocimiento de entidades, dependencias) que afina la calificación en respuestas largas.')
p('El ModelFactory selecciona el modelo apropiado según el tipo de pregunta y la configuración. Los resultados de calificación se persisten mediante el adaptador GradingRepo (SQLAlchemy async) y los resultados por lotes se encolan en Celery.', indent=True)

h2('Contexto Feedback: Retroalimentación Pedagógica')
p('El contexto Feedback expone los endpoints POST /feedback/generate, POST /feedback/analyze y POST /feedback/study-plan. Su responsabilidad es generar retroalimentación humanizada, identificar áreas con menor desempeño (umbral configurable, por defecto 60 % de acierto) y construir un plan de estudio priorizado.', indent=True)
p('La lógica se apoya en un cliente LLM (OllamaClient para entornos locales con modelos Llama 3 o Mistral; opcionalmente OpenAI en entornos productivos) y en un retriever RAG (FAISS) que indexa el contenido pedagógico institucional. La estrategia RAG asegura que el feedback se mantenga dentro del dominio académico autorizado, reduciendo el riesgo de alucinaciones.', indent=True)

h2('Contexto Assistant: Agente Tutor Conversacional')
p('El contexto Assistant implementa el agente tutor mediante LangChain en modo ReAct, con acceso a herramientas (búsqueda en el catálogo de quizzes, consulta del progreso del estudiante, recuperación vectorial sobre material pedagógico). Las sesiones de chat se almacenan en Redis con TTL de 24 horas para soportar contexto conversacional sin sobrecargar la base de datos relacional.', indent=True)
p('Los endpoints relevantes son POST /assistant/chat (turno conversacional) y GET /assistant/{session_id} (historial). La capa de presentación incluye middleware de autenticación y limitación por usuario.', indent=True)

h2('Contexto Analytics: Análisis y Métricas IA')
p('El contexto Analytics expone GET /analytics/difficulty y GET /analytics/anomalies. Aplica K-Means sobre la tasa de error real de cada pregunta para reclasificar dinámicamente su dificultad, y utiliza IsolationForest para detectar preguntas con patrones de respuesta atípicos (posibles errores de redacción o claves incorrectas).', indent=True)

h2('Comunicación entre NestJS y FastAPI')
p('NestJS actúa como orquestador. Su módulo AIClientModule encapsula la comunicación con FastAPI mediante un cliente HTTP tipado, configurado con timeout, reintentos exponenciales y un circuit breaker básico. La autenticación entre servicios se realiza mediante JWT propio firmado con HMAC compartida, complementado con propagación del Bearer del usuario en operaciones que requieren contexto.', indent=True)

figure_placeholder('Flujo de calificación IA: interacción NestJS → FastAPI. Fuente: diagrams/06b_Secuencias_PlayQuiz.puml.')

h2('Patrones y Principios')
p('El Agente IA se diseña bajo los principios SOLID y los patrones Strategy (modelos intercambiables), Factory (ModelFactory), Adapter (OllamaClient, SentenceTransformers), Observer (eventos Celery), Command (casos de uso) y Template Method (BaseUseCase). La estrategia de pruebas combina pruebas unitarias con mocks de LLM, pruebas de integración contra una instancia local de Ollama y pruebas funcionales contra el servicio completo en contenedor.', indent=True)

page_break()

# ============================================================
# 9. ESTRATEGIA METODOLÓGICA Y DESARROLLO
# ============================================================
h1('Estrategia Metodológica y Desarrollo')

p('Para este proyecto se eligió Scrum como marco metodológico principal. Esta metodología permitió dividir el trabajo en ciclos iterativos, garantizar entregas funcionales constantes y mantener una comunicación directa con la dirección académica. Como complemento, se incorporaron prácticas de integración continua, revisión de código y pruebas automatizadas.', indent=True)

h2('Artefactos y Ceremonias')
bullet('Product Backlog: lista priorizada de historias de usuario centradas en los módulos de acceso, evaluación, calificación, retroalimentación y notificación.')
bullet('Sprints de dos semanas: ciclos de desarrollo con entregables verificables al final de cada iteración.')
bullet('Daily meetings: reuniones diarias de máximo 15 minutos para identificar avances, obstáculos y compromisos.')
bullet('Sprint reviews y retrospectivas: para evaluar el avance del producto y reflexionar sobre las mejoras de procesos.')
bullet('Definition of Done: código implementado y revisado, pruebas unitarias con cobertura ≥ 80 %, pruebas funcionales aprobadas, documentación técnica actualizada, contratos OpenAPI sincronizados y validación pedagógica del entregable.')

h2('Fases de Desarrollo y Cronograma')
p('La ejecución se estructuró en cinco fases estratégicas, alineadas con los sprints Scrum:', indent=True)

fases = [
    ['Fase 1', 'Identificación y Análisis', '11 mar a 06 abr 2026', 'Definición de requerimientos, evaluación de la problemática y construcción del Product Backlog.'],
    ['Fase 2', 'Diseño y Prueba Piloto', '06 abr a 24 abr 2026', 'Diseño de interfaces en Figma (login, registro, dashboards y evaluaciones); validación con stakeholders.'],
    ['Fase 3', 'Modelado y Documentación', '27 abr a 30 abr 2026', 'Elaboración de historias de usuario detalladas, diagramas Entidad Relacion, modelo relacional, normalización y diagramas UML.'],
    ['Fase 4', 'Desarrollo e Implementación Técnica', '04 may a 22 may 2026', 'Construcción de la arquitectura de microservicios: backend NestJS con JWT y OAuth; microservicio FastAPI con calificación y feedback IA; frontend Next.js.'],
    ['Fase 5', 'Testing Integral y Cierre', '22 may a 30 may 2026', 'Pruebas funcionales, de integración entre NestJS y FastAPI y de usabilidad; cierre y entrega de la documentación técnica.'],
]
table_with_header(['Fase', 'Nombre', 'Periodo', 'Actividades'], fases,
                  caption_text='Fases del proyecto y cronograma de ejecución.')

h2('Implementación Técnica')
p('Se utilizó NestJS como backend principal, por su estructura modular robusta para la gestión de usuarios y la lógica de negocio, y FastAPI como microservicio especializado en inteligencia artificial. La comunicación entre servicios se realizó mediante HTTP/JSON (REST) sobre TLS, con autenticación inter-servicio basada en JWT firmado. La capa de presentación se construyó con Next.js 16 (App Router), Atomic Design, Tailwind CSS, Auth.js v5 y Redux Toolkit para el manejo del estado de autenticación en cliente.', indent=True)

page_break()

# ============================================================
# 10. DOCUMENTACIÓN SCRUM
# ============================================================
h1('Documentación Scrum')

h2('Sprint 1: Gestión de Acceso')
p('Periodo: del 11 al 24 de marzo de 2026.', indent=True)
bullet('Objetivo: implementar el módulo de login y registro como base de persistencia y trazabilidad de los datos neuroeducativos.')
bullet('Historias de usuario: HU-01, HU-02, HU-03.')
bullet('Velocidad: 11 puntos completados.')
bullet('Entregables: autenticación JWT funcional, registro de usuarios, recuperación de contraseña e integración OAuth con Google y Microsoft.')
bullet('Impedimento resuelto: configuración inicial de bcrypt y de la rotación de refresh tokens.')

h2('Sprint 2: Creación y Respuesta de Evaluaciones')
p('Periodo: del 25 de marzo al 24 de abril de 2026.', indent=True)
bullet('Objetivo: implementar los flujos de creación de evaluaciones manuales y asistidas por IA, publicación y respuesta.')
bullet('Historias de usuario: HU-04 a HU-08.')
bullet('Velocidad: 31 puntos completados.')
bullet('Entregables: módulo Quiz con creación manual, generador IA (tiempo medio 8 segundos por evaluación), publicación, listado filtrable y motor de resolución con cronómetro.')
bullet('Impedimento resuelto: diferencias de configuración CORS entre NestJS y FastAPI.')

h2('Sprint 3: Calificación Automática y Retroalimentación con IA')
p('Periodo: del 25 de abril al 22 de mayo de 2026.', indent=True)
bullet('Objetivo: implementar la calificación automática con FastAPI y la entrega de retroalimentación humanizada del agente IA.')
bullet('Historias de usuario: HU-09 a HU-12.')
bullet('Velocidad: 36 puntos completados.')
bullet('Entregables: calificación automática (objetivas + abiertas), feedback contextualizado (tiempo medio 11 segundos), notificaciones en tiempo real por WebSocket y panel de resultados del docente.')
bullet('Sin impedimentos relevantes.')

h2('Sprint 4: Pruebas y Cierre')
p('Periodo: del 22 al 30 de mayo de 2026.', indent=True)
bullet('Objetivo: ejecutar pruebas funcionales, de integración y usabilidad sobre los módulos entregados; consolidar la documentación técnica.')
bullet('Velocidad: 9 puntos completados (tareas técnicas y de documentación).')
bullet('Entregables: suite de pruebas unitarias, suite E2E con Playwright, informe de pruebas funcionales, documentación API en Swagger/OpenAPI y el presente documento técnico.')

h2('Reuniones Diarias')
p('Las reuniones diarias se llevaron a cabo cada día hábil durante los sprints activos, con una duración máxima de 15 minutos. En cada sesión, los miembros del equipo respondieron a las tres preguntas estándar de Scrum: ¿qué hice ayer?, ¿qué haré hoy?, y ¿qué obstáculos enfrento? Los compromisos se registraron en el tablero del Sprint Backlog.', indent=True)

h2('Definition of Done')
p('Una historia de usuario se consideró terminada cuando se cumplían todos los siguientes criterios:', indent=True)
bullet('Código implementado, revisado mediante pull request y fusionado en la rama principal.')
bullet('Pruebas unitarias escritas con una cobertura mínima del 80 % para el servicio correspondiente.')
bullet('Pruebas funcionales ejecutadas y superadas, conforme a los criterios de aceptación definidos.')
bullet('Documentación técnica actualizada con contratos de API en Swagger, comentarios en el código y archivo README.')
bullet('Pantallas validadas en Figma y aprobadas previo a la codificación del frontend.')
bullet('Integración verificada con endpoint accesible desde Next.js, sin errores de CORS ni de autenticación.')
bullet('Datos persistidos correctamente en PostgreSQL conforme al esquema relacional definido.')

page_break()

# ============================================================
# 11. PLAN DE PRUEBAS
# ============================================================
h1('Plan de Pruebas')

h2('Objetivo')
p('Asegurar que el módulo de evaluación y los componentes asociados del sistema cumplan correctamente con todos los requerimientos funcionales y no funcionales, garantizando la calidad del software y la experiencia del usuario.', indent=True)

h2('Objetivos Específicos')
bullet('Comprobar el correcto funcionamiento del módulo de autenticación y autorización JWT para los roles estudiante, docente y administrador.')
bullet('Probar los flujos completos de creación, inicio, calificación automática y feedback inteligente en las evaluaciones.')
bullet('Verificar la comunicación REST entre los microservicios NestJS y FastAPI para la calificación IA y el agente.')
bullet('Medir el rendimiento del sistema bajo condiciones de carga concurrente, validando tiempos de respuesta API y métricas Core Web Vitals.')
bullet('Verificar el cumplimiento de accesibilidad WCAG 2.1 nivel AA en la interfaz Next.js.')
bullet('Confirmar la persistencia, integridad y trazabilidad de la información almacenada en PostgreSQL y Redis.')
bullet('Validar la experiencia de usuario (UX) y la usabilidad de la plataforma respecto a los prototipos de Figma aprobados.')

h2('Estrategia General')
p('La estrategia se basa en la pirámide de pruebas, priorizando pruebas unitarias, seguidas de pruebas de integración y finalmente pruebas funcionales o E2E. Las pruebas se ejecutan en pipelines de integración continua y los reportes se publican junto con cada release candidate.', indent=True)

bullet('Pruebas unitarias: verifican cada componente de forma independiente (funciones puras, servicios, casos de uso, value objects).')
bullet('Pruebas de integración: validan la interacción entre módulos, microservicios, bases de datos y APIs REST.')
bullet('Pruebas funcionales o E2E: evidencian flujos completos desde la perspectiva del usuario, incluyendo autenticación, evaluación, calificación y feedback.')

h2('Alcance')
bullet('Pruebas unitarias de funciones puras, servicios NestJS y lógica de cálculo en FastAPI.')
bullet('Pruebas de integración entre controladores, servicios, ORM TypeORM y las bases de datos PostgreSQL y Redis.')
bullet('Validación de la comunicación entre microservicios mediante protocolo REST.')
bullet('Pruebas funcionales E2E de los flujos completos de autenticación, creación, resolución, calificación y feedback inteligente.')
bullet('Verificación de la persistencia, integridad y trazabilidad de los datos académicos y de los registros de actividad.')
bullet('Evaluaciones de rendimiento por carga concurrente y análisis de tiempos de respuesta de las APIs y del front-end.')
bullet('Validación de métricas Core Web Vitals en la interfaz Next.js.')
bullet('Pruebas de seguridad asociadas a JWT, control de permisos e inyección SQL.')
bullet('Verificación de la accesibilidad WCAG 2.1 nivel AA.')
bullet('Validación de la usabilidad y de la experiencia de usuario respecto a los prototipos aprobados en Figma.')

h2('Casos de Prueba por Tecnología')
cp = [
    ['Unitaria', 'Next.js', 'Validar que el componente QuestionCard muestre las opciones, deshabilite el botón mientras se carga y resalte la respuesta correcta.', 'Jest + React Testing Library', 'Componentes UI y custom hooks (useTimer, useQuizSession).'],
    ['Unitaria', 'NestJS', 'Comprobar que RegisterUseCase ejecute el algoritmo de hashing bcrypt y persista el usuario con role USER por defecto.', 'Jest + Nest Testing Utilities', 'Casos de uso, servicios, guards y value objects (Email, Password).'],
    ['Unitaria', 'FastAPI', 'Comprobar que el preprocesador de texto normalice acentos, elimine stopwords y devuelva el embedding correcto.', 'Pytest + Pytest-asyncio', 'Funciones NLP, schemas Pydantic y estrategias de calificación.'],
    ['Integración', 'Next.js', 'Comprobar que el formulario de inicio de sesión envíe correctamente las credenciales y reciba el token.', 'Jest + Mock Service Worker', 'Formularios React Hook Form con validación Zod, manejo de sesión.'],
    ['Integración', 'NestJS', 'Verificar el flujo completo POST /quiz/:id/start → answer → complete con persistencia en PostgreSQL.', 'Jest + Supertest', 'Controladores, casos de uso, repositorios TypeORM.'],
    ['Integración', 'FastAPI', 'Validar la calificación de una respuesta abierta y su persistencia en PostgreSQL.', 'Pytest + httpx TestClient', 'Routers, casos de uso, repositorios SQLAlchemy.'],
    ['Funcional E2E', 'Web', 'Flujo completo: registro → login → resolver quiz → recibir feedback → ver progreso.', 'Playwright', 'Recorrido end-to-end estudiante.'],
    ['Rendimiento', 'API', 'Carga concurrente sobre /auth/login y /quiz/:id/complete (100 usuarios en 60 s).', 'k6', 'Latencia p95, tasa de error y throughput.'],
    ['Accesibilidad', 'Web', 'Auditar las pantallas críticas con reglas WCAG 2.1 AA.', 'Lighthouse + axe-core', 'Contraste, navegación por teclado, etiquetas ARIA.'],
]
table_with_header(['Tipo', 'Tecnología', 'Descripción del caso', 'Herramienta', 'Cobertura'], cp,
                  caption_text='Casos de prueba representativos por tipo y tecnología.')

page_break()

# ============================================================
# 12. RESULTADOS Y DISCUSIÓN
# ============================================================
h1('Resultados y Discusión')

h2('Productos y Entregables')
bullet('Documentación de análisis: historias de usuario, Product Backlog y criterios de aceptación.')
bullet('Documentación técnica: diagramas UML, modelo entidad-relación, modelo relacional físico y análisis de normalización.')
bullet('Diseños de interfaz en Figma para los flujos de login, registro, dashboards, creación de evaluaciones, respuesta, visualización del feedback y portal administrativo.')
bullet('Arquitectura de microservicios con NestJS y FastAPI, con APIs REST contratadas, documentadas y validadas.')
bullet('Módulo de gestión de acceso (login y registro) en NestJS con autenticación JWT, OAuth 2.0 (Google y Microsoft), manejo de sesiones y trazabilidad.')
bullet('Implementación funcional del módulo de evaluación: creación, resolución, calificación automática y feedback proporcionado por el agente IA, integrado con el stack tecnológico definido.')
bullet('Suite de pruebas automatizadas (unitarias, integración y E2E) y reporte de cumplimiento.')

h2('Discusión, Implicaciones y Contrastación')
p('Los resultados obtenidos transforman la evaluación ,tradicionalmente estática y descontextualizada, en una herramienta diagnóstica efectiva. La retroalimentación proporcionada por el agente IA reduce la carga cognitiva del estudiante en comparación con las plataformas analizadas durante el levantamiento (Google Classroom, Moodle, Kahoot, Quizizz), donde el feedback inmediato es escaso o inexistente. La integración con el módulo de logros y notificaciones añade un componente motivacional alineado con los principios de la neuroeducación.', indent=True)

p('Desde el punto de vista técnico, la arquitectura de microservicios permite que el componente de IA evolucione (cambio de modelo, ampliación de capacidades) sin afectar al backend principal ni al frontend. La separación entre NestJS (lógica transaccional) y FastAPI (lógica analítica) refleja las recomendaciones de la literatura revisada.', indent=True)

h2('Cumplimiento de Objetivos y Limitaciones')
p('Se cumplió con la totalidad de los objetivos establecidos para el periodo de práctica. La principal limitación fue el tiempo: la integración con los 18 ejes globales del aplicativo matriz quedó fuera del alcance, así como la implementación de un modelo propio fine-tuneado. Adicionalmente, las pruebas con usuarios reales se limitaron a una muestra reducida, por lo cual se recomienda extender la validación en una fase posterior.', indent=True)

h2('Aprendizaje y Recomendaciones')
p('La práctica fortaleció el conocimiento en arquitecturas modernas (microservicios, hexagonal, clean architecture) y permitió aplicar de manera práctica principios de neurociencia al desarrollo de software. Se recomienda a la empresa continuar con el despliegue de los ejes restantes siguiendo el modelo de microservicios entregado, documentar los contratos API con Swagger/OpenAPI desde el inicio de cada iteración, mantener una cobertura de pruebas mínima del 80 % y considerar la incorporación de telemetría (OpenTelemetry) para observabilidad end-to-end.', indent=True)

page_break()

# ============================================================
# 13. REFERENCIAS
# ============================================================
h1('Referencias')

refs = [
    'Belcic, I., & Stryker, C. (2025, mayo 2). Agentes de IA en 2025: expectativas frente a realidad. IBM. https://www.ibm.com/es-es/think/insights/ai-agents-2025-expectations-vs-reality',
    'Burbano-Enríquez, B., Moncayo-Cueva, H., & Andrade-Zuleta, A. (2025). Neuroeducation and the influence of AI on early childhood education: A systematic review. Multidisciplinary Reviews, 9(6), 2026238.',
    'Caballero, M., & Llorent, V. J. (2022). The effects of a neuroeducational intervention on academic performance: A quasi-experimental study. Frontiers in Psychology, 13.',
    'Jin, Z., Yin, J., Tian, Q., Zhou, X., Li, Y., Yang, T., & Luo, J. (2026). Can large language models teach creativity? Cognitive gains, affective gaps, and distinct neural patterns. Computers in Human Behavior.',
    'Li, S., Zhang, H., Jia, Z., Zhong, C., Zhang, C., Shan, Z., Shen, J., & Babar, M. A. (2021). Understanding and addressing quality attributes of microservices architecture: A systematic literature review. Information and Software Technology, 131, 106449. https://doi.org/10.1016/j.infsof.2020.106449',
    'Ouyang, F., & Jiao, P. (2021). Artificial intelligence in education: The three paradigms. Computers and Education: Artificial Intelligence, 2, 100020. https://doi.org/10.1016/j.caeai.2021.100020',
    'Valderas, P., Torres, V., & Pelechano, V. (2020). A microservice composition approach based on the choreography of BPMN fragments. Information and Software Technology, 127, 106370.',
    'Waseem, M., Liang, P., & Shahin, M. (2021). A systematic mapping study on microservices architecture in DevOps. Journal of Systems and Software, 170, 110798. https://doi.org/10.1016/j.jss.2020.110798',
    'Xu, X., Cao, X., & Wu, Q. (2026). Impact of educational agents on student\'s learning outcomes: A meta-analysis. Frontiers in Psychology, 17, 1707196. https://doi.org/10.3389/fpsyg.2026.1707196',
    'Zhang, K., & Aslan, A. B. (2021). AI technologies for education: Recent research and future directions. Computers and Education: Artificial Intelligence, 2, 100025. https://doi.org/10.1016/j.caeai.2021.100025',
]
for r in refs:
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Cm(1.27)
    para.paragraph_format.first_line_indent = Cm(-1.27)
    para.add_run(r)

# ============================================================
# SAVE
# ============================================================
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc.save(OUT)
print(f"Saved: {OUT}")
