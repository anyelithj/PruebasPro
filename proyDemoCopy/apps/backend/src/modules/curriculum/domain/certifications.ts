import { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import { Language } from '../../../shared/domain/language.vo';
import { LanguageSkill } from '../../../shared/domain/language-skill.vo';
// [Catálogo de certificaciones · Etapa 5 de la especificación MCER]: exámenes oficiales por idioma con su relación MCER y las pruebas que evalúan, SOLO desde información pública | [Patrón]: Registry (SSOT) | [Principio]: OCP (nueva certificación = nueva entrada) + SSOT | [Paradigma]: Declarativo
// [Regla del producto]: la plataforma prepara con ítems ORIGINALES; nunca reproduce ni copia preguntas de exámenes oficiales, y no es un centro examinador
// [Honestidad]: `cefrMapping: 'approximate'` cuando el examinador no publica una equivalencia MCER oficial → la UI lo muestra así (no se afirma lo que no es oficial)

export interface CertificationLevel {
  cefr: CefrLevel; // Nivel MCER al que corresponde (u orienta, si es aproximado)
  exam: string; // Nombre del examen o diploma de ese nivel
}

export interface Certification {
  id: string; // Identificador estable en URLs
  name: string;
  language: Language;
  issuer: string; // Organismo que lo emite
  levels: ReadonlyArray<CertificationLevel>;
  skills: ReadonlyArray<LanguageSkill>; // Competencias que evalúan sus pruebas
  cefrMapping: 'official' | 'approximate';
  url: string | null; // Página oficial de especificaciones públicas (null = consultar al centro examinador)
}

const FOUR_SKILLS: ReadonlyArray<LanguageSkill> = [
  LanguageSkill.READING,
  LanguageSkill.LISTENING,
  LanguageSkill.WRITING,
  LanguageSkill.SPEAKING,
];
const { A1, A2, B1, B2, C1, C2 } = CefrLevel; // Desestructuración (ES2015): nombres cortos para la tabla

// `Object.freeze` (JS): catálogo inmutable en runtime
export const CERTIFICATIONS: ReadonlyArray<Certification> = Object.freeze([
  {
    id: 'cambridge',
    name: 'Cambridge English Qualifications',
    language: Language.EN,
    issuer: 'Cambridge University Press & Assessment',
    levels: [
      { cefr: A2, exam: 'A2 Key' },
      { cefr: B1, exam: 'B1 Preliminary' },
      { cefr: B2, exam: 'B2 First' },
      { cefr: C1, exam: 'C1 Advanced' },
      { cefr: C2, exam: 'C2 Proficiency' },
    ],
    skills: [...FOUR_SKILLS, LanguageSkill.GRAMMAR],
    cefrMapping: 'official',
    url: 'https://www.cambridgeenglish.org/exams-and-tests/',
  },
  {
    id: 'delf-dalf',
    name: 'DELF / DALF',
    language: Language.FR,
    issuer: 'France Éducation international',
    levels: [
      { cefr: A1, exam: 'DELF A1' },
      { cefr: A2, exam: 'DELF A2' },
      { cefr: B1, exam: 'DELF B1' },
      { cefr: B2, exam: 'DELF B2' },
      { cefr: C1, exam: 'DALF C1' },
      { cefr: C2, exam: 'DALF C2' },
    ],
    skills: FOUR_SKILLS,
    cefrMapping: 'official',
    url: 'https://www.france-education-international.fr/',
  },
  {
    id: 'goethe',
    name: 'Goethe-Zertifikat',
    language: Language.DE,
    issuer: 'Goethe-Institut',
    levels: [
      { cefr: A1, exam: 'Goethe-Zertifikat A1' },
      { cefr: A2, exam: 'Goethe-Zertifikat A2' },
      { cefr: B1, exam: 'Goethe-Zertifikat B1' },
      { cefr: B2, exam: 'Goethe-Zertifikat B2' },
      { cefr: C1, exam: 'Goethe-Zertifikat C1' },
      { cefr: C2, exam: 'Goethe-Zertifikat C2' },
    ],
    skills: FOUR_SKILLS,
    cefrMapping: 'official',
    url: 'https://www.goethe.de/',
  },
  {
    id: 'dele',
    name: 'DELE',
    language: Language.ES,
    issuer: 'Instituto Cervantes',
    levels: [
      { cefr: A1, exam: 'DELE A1' },
      { cefr: A2, exam: 'DELE A2' },
      { cefr: B1, exam: 'DELE B1' },
      { cefr: B2, exam: 'DELE B2' },
      { cefr: C1, exam: 'DELE C1' },
      { cefr: C2, exam: 'DELE C2' },
    ],
    skills: FOUR_SKILLS,
    cefrMapping: 'official',
    url: 'https://examenes.cervantes.es/',
  },
  {
    id: 'celpe-bras',
    name: 'Celpe-Bras',
    language: Language.PT,
    issuer: 'Inep / Ministério da Educação (Brasil)',
    // Un único examen que certifica por desempeño; la relación con el MCER es orientativa
    levels: [
      { cefr: B1, exam: 'Intermediário' },
      { cefr: B2, exam: 'Intermediário Superior' },
      { cefr: C1, exam: 'Avançado' },
      { cefr: C2, exam: 'Avançado Superior' },
    ],
    skills: FOUR_SKILLS,
    cefrMapping: 'approximate',
    url: 'https://www.gov.br/inep/',
  },
  {
    id: 'hsk',
    name: 'HSK (汉语水平考试)',
    language: Language.ZH,
    issuer: 'Chinese Testing International',
    // El HSK no publica una equivalencia oficial con el MCER → orientativa
    levels: [
      { cefr: A1, exam: 'HSK 1' },
      { cefr: A2, exam: 'HSK 2' },
      { cefr: B1, exam: 'HSK 3' },
      { cefr: B2, exam: 'HSK 4' },
      { cefr: C1, exam: 'HSK 5' },
      { cefr: C2, exam: 'HSK 6' },
    ],
    skills: [
      LanguageSkill.LISTENING,
      LanguageSkill.READING,
      LanguageSkill.WRITING,
    ],
    cefrMapping: 'approximate',
    url: 'https://www.chinesetest.cn/',
  },
  {
    id: 'torfl',
    name: 'TORFL (ТРКИ)',
    language: Language.RU,
    issuer: 'Sistema estatal de exámenes de ruso como lengua extranjera',
    levels: [
      { cefr: A1, exam: 'ТЭУ (elemental)' },
      { cefr: A2, exam: 'ТБУ (básico)' },
      { cefr: B1, exam: 'ТРКИ-1' },
      { cefr: B2, exam: 'ТРКИ-2' },
      { cefr: C1, exam: 'ТРКИ-3' },
      { cefr: C2, exam: 'ТРКИ-4' },
    ],
    skills: [...FOUR_SKILLS, LanguageSkill.GRAMMAR],
    cefrMapping: 'official',
    url: null,
  },
] satisfies Certification[]);

// [certificationsFor]: catálogo filtrado por idioma | función pura
export const certificationsFor = (language?: Language): Certification[] =>
  CERTIFICATIONS.filter((c) => !language || c.language === language);

export const findCertification = (id: string): Certification | undefined =>
  CERTIFICATIONS.find((c) => c.id === id);

// [practiceTopic]: tema con el que se guardan los ítems de preparación → se agrupan solos en el catálogo de recursos (sin columna nueva) | [Principio]: KISS
export const practiceTopic = (exam: string, skillLabel: string): string =>
  `Preparación ${exam} · ${skillLabel}`;

// [Instrucción de originalidad]: se añade al prompt de la IA en toda práctica de certificación
export const originalityGuidance = (
  c: Certification,
  level: CertificationLevel,
): string =>
  `Prepara para el formato de ${level.exam} (${c.name}) según sus especificaciones PÚBLICAS: crea ítems ORIGINALES de práctica; no reproduzcas, adaptes ni cites preguntas, textos o audios de exámenes oficiales ni de modelos publicados.`;
