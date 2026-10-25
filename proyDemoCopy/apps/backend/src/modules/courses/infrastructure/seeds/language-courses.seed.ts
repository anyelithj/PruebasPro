import type { Course } from '../../domain/entities/course.entity';
import {
  ACTIVE_COURSE_GROUPS,
  COURSE_GROUP_LANGUAGE,
  CourseCategory,
  CourseGroup,
} from '../../domain/value-objects/course-category.vo';
import {
  CEFR_LEVELS,
  CEFR_LEVEL_LABEL_ES,
  CefrLevel,
} from '../../../../shared/domain/cefr-level.vo';
import { LANGUAGE_LABEL } from '../../../../shared/domain/language.vo';
// [Seed catálogo de idiomas]: 7 idiomas × 6 niveles MCER = 42 cursos generados por código, no a mano | [Patrón]: Factory + Data Seeding | [Principio]: DRY + SRP | [Paradigma]: Funcional (map/flatMap, sin mutación)
// [Tecnología]: TypeScript puro; lo consume el adapter TypeORM (CourseRepository) en el arranque del módulo
// [Honestidad de datos]: sin instructores, ratings, alumnos ni horas inventadas → valores neutros (0 / "Contenido propio")

// [Color por idioma]: gama índigo/violeta/fucsia/azul de la marca, sin verdes | `Readonly<Record<...>>` (TS) = tabla inmutable
const LANGUAGE_COLOR: Readonly<Record<string, string>> = Object.freeze({
  [CourseGroup.EN]: '#6366F1', // indigo-500
  [CourseGroup.FR]: '#8B5CF6', // violet-500
  [CourseGroup.DE]: '#A855F7', // purple-500
  [CourseGroup.ES]: '#D946EF', // fuchsia-500
  [CourseGroup.PT]: '#EC4899', // pink-500
  [CourseGroup.ZH]: '#F43F5E', // rose-500
  [CourseGroup.RU]: '#3B82F6', // blue-500
});

// [Resumen pedagógico por nivel]: paráfrasis propia de los descriptores globales del MCER (no copia literal) | [Patrón]: Lookup Table
const LEVEL_SUMMARY: Readonly<Record<CefrLevel, string>> = Object.freeze({
  [CefrLevel.A1]:
    'Frases básicas y expresiones cotidianas para presentarte y cubrir necesidades inmediatas.',
  [CefrLevel.A2]:
    'Situaciones habituales: compras, familia, trabajo y entorno cercano con frases sencillas.',
  [CefrLevel.B1]:
    'Ideas principales de textos claros sobre temas conocidos y relato de experiencias y planes.',
  [CefrLevel.B2]:
    'Textos complejos, conversación con fluidez y argumentación sobre temas diversos.',
  [CefrLevel.C1]:
    'Textos extensos y exigentes, expresión espontánea y uso flexible en contextos académicos y profesionales.',
  [CefrLevel.C2]:
    'Comprensión de prácticamente todo lo que se lee u oye y expresión precisa con matices finos.',
});

// `export function` (ES Modules + JS): fábrica pura → mismo resultado para la misma entrada (fácil de testear)
export function buildLanguageCourseSeed(): Partial<Course>[] {
  // `flatMap` (ES2019): por cada idioma genera 6 cursos y aplana el resultado a un solo array de 42
  return ACTIVE_COURSE_GROUPS.flatMap((group) => {
    const language = COURSE_GROUP_LANGUAGE[group]!; // `!` (TS, non-null assertion): los grupos vigentes siempre tienen idioma
    const languageName = LANGUAGE_LABEL[language]; // "Inglés", "Francés"…
    // `map` (ES5): transforma cada nivel en un objeto curso; no muta el array original (Paradigma Funcional)
    return CEFR_LEVELS.map((level) => ({
      title: `${languageName} ${level}`, // Template literal (ES2015): "Inglés B1"
      slug: `${language}-${level.toLowerCase()}`, // Slug estable e idempotente: "en-b1"
      shortDescription: `${CEFR_LEVEL_LABEL_ES[level]}. ${LEVEL_SUMMARY[level]}`, // Descriptor MCER + resumen
      description: `Curso de ${languageName.toLowerCase()} de nivel ${level}: gramática, vocabulario, comprensión lectora y auditiva, expresión escrita y oral, y pronunciación. Las explicaciones y traducciones se muestran en español.`,
      category: level as unknown as CourseCategory, // Cast doble (TS): CefrLevel y CourseCategory comparten los valores 'A1'…'C2'
      group, // Shorthand property (ES2015): idioma del curso
      instructor: 'Contenido propio', // Contenido introducido y revisado manualmente, no un docente ficticio
      instructorTitle: null, // `null`: ausencia explícita de valor (columna nullable)
      color: LANGUAGE_COLOR[group], // Color de marca por idioma
      icon: language.toUpperCase(), // Código ISO como icono textual (evita banderas: un idioma ≠ un país)
      tags: [level], // Etiqueta visible con el nivel
      eje: 1, // Columna heredada del catálogo anterior; no se usa en el catálogo de idiomas
      lab: null,
      price: 0, // Proyecto educativo/portafolio: sin cobro
      originalPrice: null,
      currency: 'USD',
      durationHours: 0, // 0 = no declarado (las horas guía varían por idioma; no se inventan)
      level: CEFR_LEVEL_LABEL_ES[level], // Texto legible del nivel
      rating: 0, // Sin valoraciones reales todavía
      studentsCount: 0, // Sin alumnos reales todavía
      modality: 'Online',
      isProBono: false,
      isPublished: true, // Publicado por defecto; el admin puede despublicar desde el panel
    }));
  });
}
