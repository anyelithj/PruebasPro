import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client'; // [Adapter compartido]: un solo cliente HTTP de Ollama por servicio
import {
  LANGUAGE_LABEL,
  type Language,
} from '../../../../shared/domain/language.vo';
// [UseCase DraftCourse · 2026-10-23]: BORRADOR de curso para el formulario de Gestión → título, descripción en Markdown (objetivos + temario) y etiquetas sugeridas; NO guarda nada (el administrador revisa y guarda) | [Patrón]: Use Case (Query) + Adapter (OllamaClient) | [Principio]: SRP + revisión humana | [Paradigma]: POO + async/await

export interface CourseDraftRequest {
  language: Language; // Idioma que enseña el curso (EN, FR…)
  level: string; // Nivel MCER (A1…C2)
  topic?: string; // Enfoque opcional ("inglés para viajes")
  text?: string; // Contenido importado (PDF/Word/URL) a resumir como descripción
}

export interface CourseDraft {
  title: string;
  description: string; // Markdown
  tags: string[]; // Sugeridas; el frontend filtra a su lista cerrada
}

const MAX_DESCRIPTION = 4000; // = límite del formulario (UpdateCourseDto.description)

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
    const focus = req.topic?.trim() ? ` focused on "${req.topic.trim()}"` : '';
    // [Prompt]: todo en español (el catálogo es para hispanohablantes); el temario nombra contenidos del idioma objetivo
    const prompt = [
      `Eres diseñador curricular. Crea la ficha de un curso de ${lang} nivel MCER ${req.level}${focus} para hispanohablantes.`,
      req.text
        ? `Basa el curso en este contenido (resúmelo, no lo copies entero):\n${req.text.slice(0, 5000)}`
        : '',
      'Devuelve SOLO JSON: {"title":"título corto y atractivo en español","description":"Markdown en español con: un párrafo de presentación, ## Objetivos (4 viñetas), ## Temario (6 módulos en lista numerada) y ## A quién va dirigido","tags":["2 a 4 de: Conversación, Gramática, Vocabulario, Pronunciación, Lectura, Escritura, Comprensión auditiva, Certificación, Negocios, Viajes"]}',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.5, num_predict: 900, num_ctx: 8192 },
    });
    let raw: { title?: unknown; description?: unknown; tags?: unknown };
    try {
      raw = JSON.parse(res.response ?? '{}') as typeof raw;
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : '';
    if (!title || !description)
      throw new ServiceUnavailableException(
        'La IA no completó la ficha del curso. Intenta de nuevo.',
      );
    return {
      title: title.slice(0, 200),
      description: description.slice(0, MAX_DESCRIPTION),
      tags: (Array.isArray(raw.tags) ? raw.tags : [])
        .filter((t): t is string => typeof t === 'string') // Type guard (TS): descarta basura del LLM
        .map((t) => t.trim())
        .slice(0, 6),
    };
  }
}
