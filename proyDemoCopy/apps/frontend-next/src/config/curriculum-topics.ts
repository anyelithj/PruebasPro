import type { CefrLevel } from "@/types/courses";
import type { CurriculumItemKind } from "@/types/curriculum";
import type { Language } from "@/types/quiz";
import { IPA_CHARTS, phonemeTopic } from "@/config/ipa-chart"; // [2026-10-23 · 4.º pase]: los temas de Pronunciación son los fonemas IPA del idioma
// [Catálogo curado de temas]: lista determinista por tipo de recurso × idioma × nivel MCER (sin IA) → el autor elige de una lista clara
// [Patrón]: Lookup Table + Registry | [Principio]: SSOT (config) + OCP (añadir temas = añadir filas) + Deterministic-first (la IA solo amplía) | [Paradigma]: Declarativo
// Vocabulario y frases son temas universales por nivel; la gramática depende del idioma (el "to be" solo existe en inglés)

type ByLevel = Readonly<Record<CefrLevel, ReadonlyArray<string>>>; // `Readonly` + `ReadonlyArray` (TS): tablas inmutables

// [Vocabulario]: campos léxicos por nivel
const VOCABULARY: ByLevel = {
  A1: ["Los saludos", "Los números", "Los colores", "Los días de la semana", "Los meses del año", "La hora", "La familia", "Los animales", "Las frutas", "Las verduras", "Los alimentos", "Las bebidas", "Los lácteos", "La ropa", "Las partes del cuerpo", "La casa y sus partes", "Los útiles escolares", "Las profesiones", "El clima"],
  A2: ["Los electrodomésticos", "Los muebles", "Los utensilios de cocina", "Los medios de transporte", "La ciudad y sus lugares", "Las tiendas y las compras", "Los deportes", "Los pasatiempos", "Las emociones", "La salud y las enfermedades", "Las estaciones del año", "Las fechas y celebraciones", "La naturaleza", "Los viajes"],
  B1: ["El trabajo y la oficina", "La tecnología", "El medio ambiente", "La educación", "Los medios de comunicación", "Las relaciones personales", "La vivienda", "La alimentación saludable", "El turismo", "El dinero y el banco", "La personalidad"],
  B2: ["La economía", "La política", "La ciencia", "El arte y la cultura", "La salud pública", "Las redes sociales", "La justicia", "La publicidad", "El mundo laboral", "Los problemas sociales"],
  C1: ["Expresiones idiomáticas", "El lenguaje académico", "Los negocios y las finanzas", "La psicología", "El derecho", "La filosofía", "La literatura", "La innovación"],
  C2: ["Registros formales e informales", "Matices y sinónimos", "El lenguaje periodístico", "El lenguaje jurídico", "Jerga y coloquialismos", "Colocaciones avanzadas"],
};

// [Frases]: situaciones comunicativas por nivel
const PHRASES: ByLevel = {
  A1: ["Presentarme", "Saludar y despedirse", "Pedir la hora", "Preguntar el precio", "Pedir en un restaurante", "Hablar de la familia", "La rutina diaria", "Pedir ayuda", "Dar las gracias y disculparse", "Preguntar direcciones"],
  A2: ["Mis hobbies", "En la escuela", "En la tienda de ropa", "En el supermercado", "En el médico", "En el aeropuerto", "En el hotel", "Hacer planes con amigos", "Hablar del clima", "Hablar por teléfono"],
  B1: ["En el trabajo u oficina", "Una entrevista de trabajo", "Dar opiniones", "Quejarse de un servicio", "Contar una experiencia", "En el banco", "Alquilar una vivienda", "Dar consejos", "En la farmacia"],
  B2: ["Negociar", "Argumentar a favor y en contra", "Reuniones de trabajo", "Presentaciones en público", "Resolver conflictos", "Comentar noticias", "Hacer reclamaciones formales"],
  C1: ["Debates", "Expresar matices y dudas", "Lenguaje diplomático", "Conferencias académicas", "Persuadir"],
  C2: ["Humor e ironía", "Discursos formales", "Lenguaje figurado", "Comunicación intercultural"],
};

// [Gramática por idioma y nivel]: estructuras propias de cada lengua
const GRAMMAR: Readonly<Record<Language, ByLevel>> = {
  en: {
    A1: ["El verbo to be", "Los pronombres personales", "Los artículos (a / an / the)", "Los plurales", "El presente simple", "There is / There are", "Los adjetivos posesivos", "Los demostrativos (this / that)", "Can para habilidades", "Las preposiciones de lugar", "El imperativo"],
    A2: ["El presente continuo", "El pasado simple", "Los verbos irregulares en pasado", "El futuro con going to", "El futuro simple (will)", "Comparativos y superlativos", "Contables e incontables (some / any)", "Los adverbios de frecuencia", "Los verbos modales (can, must, should)", "Los verbos auxiliares (do, does, did)"],
    B1: ["El presente perfecto", "El pasado continuo", "Primer y segundo condicional", "La voz pasiva", "Used to", "Los pronombres relativos", "Gerundio e infinitivo", "Modales de obligación", "Preguntas indirectas"],
    B2: ["El pasado perfecto", "El tercer condicional", "El estilo indirecto", "El presente perfecto continuo", "Futuro continuo y futuro perfecto", "Modales de deducción", "Wish / If only", "Los phrasal verbs"],
    C1: ["La inversión", "Las oraciones hendidas (cleft)", "Condicionales mixtos", "Modales en pasado", "El subjuntivo", "Oraciones de participio"],
    C2: ["Elipsis y sustitución", "La nominalización", "Énfasis y estilo", "Estructuras formales avanzadas"],
  },
  fr: {
    A1: ["El verbo être", "El verbo avoir", "Los pronombres sujeto", "Los artículos definidos e indefinidos", "El género y los plurales", "El presente de los verbos en -er", "La negación (ne… pas)", "Los adjetivos posesivos", "Il y a", "Las preguntas"],
    A2: ["El passé composé", "Los verbos pronominales", "El futuro próximo (aller + infinitivo)", "El imperfecto (imparfait)", "Los artículos partitivos", "Los comparativos", "Los pronombres COD y COI", "Los verbos modales (pouvoir, vouloir, devoir)", "El futuro simple"],
    B1: ["Imparfait o passé composé", "El pluscuamperfecto", "El condicional presente", "Los pronombres relativos", "El subjuntivo presente", "Los pronombres y / en", "El estilo indirecto", "La voz pasiva"],
    B2: ["El condicional pasado", "El subjuntivo pasado", "Las hipótesis con si", "El gerundio", "La concordancia de tiempos", "Los conectores lógicos"],
    C1: ["El passé simple", "La mise en relief", "La nominalización", "El subjuntivo en registros formales"],
    C2: ["Los registros de lengua", "Las figuras de estilo", "Matices de la concordancia de tiempos"],
  },
  de: {
    A1: ["El verbo sein", "El verbo haben", "Los pronombres personales", "Los artículos (der / die / das)", "Los plurales", "El presente de los verbos regulares", "La negación (nicht / kein)", "El acusativo", "Los verbos modales (können, müssen, wollen)", "El orden de la oración"],
    A2: ["El dativo", "El Perfekt", "Los verbos separables", "Preposiciones con dativo y acusativo", "El Präteritum de sein y haben", "Los comparativos", "Los verbos reflexivos", "Subordinadas con weil y dass", "El futuro con werden"],
    B1: ["El Präteritum", "El Konjunktiv II", "La voz pasiva", "Las oraciones de relativo", "El genitivo", "La declinación del adjetivo", "Infinitivo con zu", "El Plusquamperfekt"],
    B2: ["Pasiva con verbos modales", "El Konjunktiv I (estilo indirecto)", "Conectores dobles", "La nominalización", "Participios como adjetivos", "El Futur II"],
    C1: ["La pasiva de estado", "El estilo nominal", "Las partículas modales", "Construcciones de participio avanzadas"],
    C2: ["Registros y estilo", "Construcciones literarias"],
  },
  es: {
    A1: ["Los verbos ser y estar", "Los pronombres personales", "Los artículos", "El género y los plurales", "El presente de indicativo", "Hay", "Los posesivos", "Los demostrativos", "Gustar y verbos similares", "Las preguntas"],
    A2: ["El pretérito indefinido", "El pretérito imperfecto", "El pretérito perfecto", "El futuro simple", "Ir a + infinitivo", "Los comparativos", "Los verbos reflexivos", "El imperativo", "Pronombres de objeto directo e indirecto"],
    B1: ["Indefinido o imperfecto", "El presente de subjuntivo", "El condicional simple", "El pluscuamperfecto", "Por y para", "Los pronombres relativos", "El estilo indirecto"],
    B2: ["El imperfecto de subjuntivo", "Las oraciones condicionales", "La voz pasiva", "Las perífrasis verbales", "El subjuntivo en subordinadas"],
    C1: ["El pluscuamperfecto de subjuntivo", "El condicional compuesto", "Matices del subjuntivo", "Los marcadores discursivos"],
    C2: ["Registros y estilo", "Construcciones literarias"],
  },
  pt: {
    A1: ["Los verbos ser y estar", "Los pronombres personales", "Los artículos", "El género y los plurales", "El presente de indicativo", "Ter y haver", "Los posesivos", "Preposiciones y contracciones", "Los demostrativos"],
    A2: ["El pretérito perfeito", "El pretérito imperfeito", "El futuro con ir + infinitivo", "Los comparativos", "Los verbos reflexivos", "El imperativo", "Los pronombres de objeto"],
    B1: ["El futuro do presente", "El futuro do pretérito (condicional)", "El presente de subjuntivo", "El infinitivo personal", "La voz pasiva", "Los pronombres relativos", "El pretérito mais-que-perfeito"],
    B2: ["El imperfeito do subjuntivo", "El futuro do subjuntivo", "Las oraciones condicionales", "El estilo indirecto", "La colocación pronominal"],
    C1: ["Tiempos compuestos del subjuntivo", "La mesóclise", "Registros formales"],
    C2: ["Estilística y figuras", "Variantes de Portugal y Brasil"],
  },
  zh: {
    A1: ["Los tonos", "El verbo 是", "Los pronombres personales", "Los números y clasificadores básicos", "Las preguntas con 吗", "La negación con 不", "El verbo 有", "La partícula 的", "El orden de la oración"],
    A2: ["La partícula 了", "Los clasificadores", "在 para acciones en curso", "Comparativos con 比", "La negación con 没", "Los verbos modales (会、能、可以、想)", "Las expresiones de tiempo", "过 para experiencias"],
    B1: ["Complementos de resultado", "Complementos de dirección", "La construcción 把", "La pasiva con 被", "Complementos de grado con 得", "La estructura 是…的"],
    B2: ["Complementos potenciales", "Conectores (虽然…但是, 不但…而且)", "Estructuras de énfasis", "Chengyu básicos"],
    C1: ["Chengyu", "El lenguaje escrito formal (书面语)", "Las partículas modales"],
    C2: ["Registros literarios", "El chino clásico en el chino moderno"],
  },
  ru: {
    A1: ["El alfabeto cirílico", "Los pronombres personales", "El género de los sustantivos", "Los plurales", "El presente de los verbos", "El caso nominativo", "El caso prepositivo", "Los posesivos", "Ser y estar en ruso (быть)", "Las preguntas"],
    A2: ["El caso acusativo", "El caso genitivo", "El caso dativo", "El caso instrumental", "El pasado de los verbos", "El futuro", "Los verbos de movimiento", "Los aspectos verbales (perfectivo / imperfectivo)"],
    B1: ["Verbos de movimiento con prefijos", "Los adjetivos en todos los casos", "El imperativo", "Las oraciones subordinadas", "Numerales con sustantivos", "Los pronombres reflexivos"],
    B2: ["Los participios", "Los gerundios", "La voz pasiva", "El modo condicional", "El aspecto verbal avanzado"],
    C1: ["Participios avanzados", "El estilo formal y científico", "El orden de palabras y el énfasis"],
    C2: ["Registros y estilística"],
  },
};

// [Tareas de expresión]: para rúbricas (escritura/oral) por nivel
const TASKS: ByLevel = {
  A1: ["Describirme", "Mi familia", "Mi rutina diaria", "Una postal o mensaje corto"],
  A2: ["Un correo a un amigo", "Describir mi casa", "Contar un fin de semana", "Una invitación"],
  B1: ["Una carta formal", "Contar una experiencia", "Una reseña", "Dar mi opinión"],
  B2: ["Un ensayo de opinión", "Un informe breve", "Una presentación oral", "Una reclamación formal"],
  C1: ["Un ensayo argumentativo", "Un artículo", "Un informe profesional", "Un debate oral"],
  C2: ["Un discurso", "Una crítica literaria", "Un texto académico", "Una mediación oral"],
};

const FALSE_FRIENDS = "Falsos amigos"; // Tema transversal de errores frecuentes

// [TopicGroup]: grupo de la lista (<optgroup>) → el autor ve de dónde sale cada tema
export interface TopicGroup {
  label: string;
  topics: ReadonlyArray<string>;
}

// [curatedTopics]: grupos de temas para la combinación elegida | `switch` exhaustivo sobre el tipo (TS) | [Patrón]: Strategy por tipo | [Paradigma]: Funcional (pura)
export function curatedTopics(kind: CurriculumItemKind, language: Language, level: CefrLevel): TopicGroup[] {
  const vocabulary = { label: "🔤 Vocabulario", topics: VOCABULARY[level] };
  const phrases = { label: "💬 Frases y situaciones", topics: PHRASES[level] };
  const grammar = { label: "📐 Gramática", topics: GRAMMAR[language][level] };
  switch (kind) {
    case "vocabulary":
      return [vocabulary];
    // [Pronunciación · 2026-10-23 · 4.º pase]: un grupo por tema del alfabeto IPA (vocales, consonantes, tonos…) con cada fonema «/ʃ/ · chat»;
    // al elegirlo, el formulario muestra la regla de cuándo se aplica (findPhoneme). Los campos léxicos siguen al final para pronunciar palabras sueltas
    case "pronunciation":
      return [...IPA_CHARTS[language].map((g) => ({ label: `IPA · ${g.title}`, topics: g.phonemes.map(phonemeTopic) })), vocabulary];
    case "example":
    case "translation":
      return [phrases];
    case "grammar_rule":
      return [grammar];
    case "common_error":
      return [{ ...grammar, topics: [...grammar.topics, FALSE_FRIENDS] }];
    case "exercise":
      return [grammar, vocabulary, phrases];
    case "rubric":
      return [{ label: "📋 Tareas de expresión", topics: TASKS[level] }];
  }
}
