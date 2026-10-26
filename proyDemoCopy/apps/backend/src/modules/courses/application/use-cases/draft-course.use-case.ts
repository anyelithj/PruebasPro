import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client'; // [Adapter compartido]: un solo cliente HTTP de Ollama por servicio
import {
  LANGUAGE_LABEL,
  type Language,
} from '../../../../shared/domain/language.vo';
// [UseCase DraftCourse · 2026-10-23]: BORRADOR de curso para el formulario de Gestión; NO guarda nada (el administrador revisa y guarda) | [Patrón]: Use Case (Query) + Adapter (OllamaClient) | [Principio]: SRP + revisión humana | [Paradigma]: POO + async/await
// [2026-10-25]: la FICHA (presentación, objetivos, a quién va dirigido) va en sus campos y el TEMARIO es solo la lista de subtemas del idioma
// (p. ej. «El verbo to be», «Presente simple»…) · cada subtema se explica aparte con `topic()` (definición, uso, reglas, ejemplos)

export interface CourseDraftRequest {
  language: Language; // Idioma que enseña el curso (EN, FR…)
  level: string; // Nivel MCER (A1…C2)
  topic?: string; // Enfoque opcional ("inglés para viajes")
  text?: string; // Contenido importado (PDF/Word/URL) en el que basarse
}

export interface CourseDraft {
  title: string;
  description: string; // Presentación (un párrafo)
  objectives: string; // Markdown: viñetas
  audience: string; // Un párrafo
  topics: string[]; // TEMARIO: títulos de los subtemas, en orden
  tags: string[]; // Sugeridas; el frontend filtra a su lista cerrada
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
// [bullets]: lista del LLM (array o texto) → Markdown con viñetas
const bullets = (v: unknown): string =>
  (Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : str(v, 4000).split(/\r?\n/)
  )
    .map((x) => x.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((x) => `- ${x}`)
    .join('\n');

@Injectable()
export class DraftCourseUseCase {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService, // `ConfigService` (@nestjs/config): variables de entorno
  ) {
    // [Mismo modelo compacto que los demás borradores] | `??` (ES2020): primer valor definido
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  async execute(req: CourseDraftRequest): Promise<CourseDraft> {
    const lang = LANGUAGE_LABEL[req.language];
    const focus = req.topic?.trim()
      ? ` con enfoque en "${req.topic.trim()}"`
      : '';
    const raw = await this.json(
      [
        `Eres diseñador curricular. Crea la ficha de un curso de ${lang} nivel MCER ${req.level}${focus} para hispanohablantes.`,
        req.text
          ? `Basa el curso en este contenido (resúmelo, no lo copies):\n${req.text.slice(0, 5000)}`
          : '',
        `"topics" es el TEMARIO: 12 a 20 subtemas CONCRETOS del idioma propios del nivel ${req.level}, en orden de aprendizaje, cada uno con su forma en ${lang} entre paréntesis cuando aplique (ejemplo para inglés A1: "El verbo «to be» (am / is / are)", "Pronombres de sujeto (I, you, he…)", "Presente simple: preguntas y negación"). NO pongas "Introducción", "Glosario", "Ejercicios" ni "Práctica".`,
        'Devuelve SOLO JSON: {"title":"título corto en español","description":"UN párrafo de presentación (máx. 400 caracteres)","objectives":["4 objetivos cortos"],"audience":"UN párrafo: a quién va dirigido","topics":["..."],"tags":["2 a 4 de: Conversación, Gramática, Vocabulario, Pronunciación, Lectura, Escritura, Comprensión auditiva, Certificación, Negocios, Viajes"]}',
      ]
        .filter(Boolean)
        .join('\n'),
      1800,
    );
    const title = str(raw.title, 200);
    const topics = (Array.isArray(raw.topics) ? raw.topics : [])
      .map((t) =>
        typeof t === 'string' ? t : str((t as { title?: unknown })?.title, 200),
      )
      .map((t) =>
        t
          .replace(/^[#\d.)\-\s]+/, '')
          .trim()
          .slice(0, 200),
      )
      .filter(
        (t) =>
          t &&
          !/^(introducci|glosario|ejercicio|pr[aá]ctica|repaso|cuestionario)/i.test(
            t,
          ),
      );
    if (!title || !topics.length)
      throw new ServiceUnavailableException(
        'La IA no completó el temario del curso. Intenta de nuevo.',
      );
    return {
      title,
      description: str(raw.description, 600),
      objectives: bullets(raw.objectives),
      audience: str(raw.audience, 1200),
      topics: [...new Set(topics)].slice(0, 30),
      tags: (Array.isArray(raw.tags) ? raw.tags : [])
        .filter((t): t is string => typeof t === 'string') // Type guard (TS): descarta basura del LLM
        .map((t) => t.trim())
        .slice(0, 6),
    };
  }

  // [topic · 2026-10-25]: explicación de UN subtema del temario en Markdown (definición, uso, reglas/fórmula, ejemplos con traducción, errores comunes)
  async topic(req: {
    language: Language;
    level: string;
    topic: string;
    text?: string;
  }): Promise<{ title: string; body: string }> {
    const lang = LANGUAGE_LABEL[req.language];
    const raw = await this.json(
      [
        `Eres profesor de ${lang} para hispanohablantes de nivel MCER ${req.level}. Explica el tema "${req.topic}".`,
        req.text ? `Básate en este material:\n${req.text.slice(0, 5000)}` : '',
        `Escribe en español, con los ejemplos en ${lang} y su traducción entre paréntesis. Claro y breve, del nivel ${req.level}.`,
        'Devuelve SOLO JSON: {"definition":"1-2 frases","usage":["cuándo se usa (2-4 viñetas)"],"rules":["fórmula o reglas: afirmativa, negativa, interrogativa si aplica (2-5 viñetas)"],"examples":["5 ejemplos: frase (traducción)"],"mistakes":["2 errores comunes y su corrección"]}',
      ]
        .filter(Boolean)
        .join('\n'),
      1400,
    );
    const section = (h: string, v: unknown) => {
      const b = Array.isArray(v) ? bullets(v) : str(v, 2000);
      return b ? `**${h}**\n\n${b}` : '';
    };
    const body = [
      section('Definición', raw.definition),
      section('Uso', raw.usage),
      section('Reglas', raw.rules),
      section('Ejemplos', raw.examples),
      section('Errores comunes', raw.mistakes),
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!body)
      throw new ServiceUnavailableException(
        'La IA no explicó el tema. Intenta de nuevo.',
      );
    return { title: req.topic.trim().slice(0, 200), body };
  }

  // [json]: una inferencia JSON con error accionable si no se puede leer
  private async json(
    prompt: string,
    numPredict: number,
  ): Promise<Record<string, unknown>> {
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.4, num_predict: numPredict, num_ctx: 8192 },
    });
    try {
      return JSON.parse(res.response ?? '{}') as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
  }
}
