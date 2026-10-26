import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import {
  inTargetLanguage,
  strictLine,
} from '../../../../shared/domain/target-language';
// [UseCase DraftDialogue · 2026-10-19]: BORRADOR de diálogo para el formulario de subida — desde el texto de una página (modo URL; Next.js la descarga con safeFetch) o generado por la IA (modo IA); no guarda nada: el docente revisa y guarda | [Patrón]: Use Case (Query) + Strategy (texto | IA) + Adapter (OllamaClient compartido) | [Principio]: determinístico primero (las líneas «Nombre: texto» se leen sin LLM) + SRP + revisión humana | [Paradigma]: POO + funcional (parseScript pura)

export interface DraftTurn {
  speaker: 'A' | 'B';
  text: string;
}
export interface DialogueDraft {
  title: string;
  speakers: [string, string];
  turns: DraftTurn[];
  source: 'script' | 'llm'; // Cómo se obtuvo (trazabilidad: lo de la IA se marca para revisar)
}
export interface DraftRequest {
  mode: 'text' | 'ai';
  language: Language;
  level?: string;
  topic?: string; // Modo IA: de qué trata
  text?: string; // Modo URL: texto de la página
  title?: string;
  speakers?: string[];
  turns?: number; // Modo IA: cuántos turnos (4–20)
}

const MAX_TURNS = 40;
// [Línea de guion]: «Ana: Hello!» · «- TOM: Hi» · «A) Hi» (nombre corto con mayúscula inicial y dos puntos)
const SCRIPT_LINE =
  /^\s*[-–•]?\s*([\p{Lu}][\p{L}\p{M} .'-]{0,30}?)\s*[:)]\s+(.{1,600})$/u;

// [parseScript]: texto con líneas «Nombre: frase» → turnos A/B con los dos primeros nombres que aparecen | null si no hay al menos 2 turnos de 2 hablantes | Función pura
export function parseScript(
  text: string,
): Omit<DialogueDraft, 'title' | 'source'> | null {
  const names: string[] = [];
  const turns: DraftTurn[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = SCRIPT_LINE.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    if (!names.includes(name)) {
      if (names.length === 2) continue; // Un tercer personaje no cabe en el diálogo de dos voces
      names.push(name);
    }
    turns.push({
      speaker: names.indexOf(name) === 0 ? 'A' : 'B',
      text: m[2].trim(),
    });
    if (turns.length >= MAX_TURNS) break;
  }
  return names.length === 2 && turns.length >= 2
    ? { speakers: [names[0], names[1]], turns }
    : null;
}

@Injectable()
export class DraftDialogueUseCase {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    // [Mismo modelo compacto que los borradores de práctica y currículo]
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  async execute(req: DraftRequest): Promise<DialogueDraft> {
    const title = req.title?.trim() || req.topic?.trim() || '';
    if (req.mode === 'text') {
      // [Determinístico primero]: si la página ya trae el guion «Nombre: frase», no se llama al LLM
      const script = parseScript(req.text ?? '');
      if (script) return { title, ...script, source: 'script' };
    }
    // [2026-10-25]: respuesta en español → un reintento con orden estricta de idioma
    return inTargetLanguage(
      req.language,
      (strict) => this.generate(req, title, strict),
      (d) => d.turns.map((t) => t.text).join(' '),
    );
  }

  private async generate(
    req: DraftRequest,
    title: string,
    strict: boolean,
  ): Promise<DialogueDraft> {
    const speakers = this.speakers(req.speakers);
    const lang = LANGUAGE_NAME_EN[req.language];
    const count = Math.min(Math.max(req.turns ?? 8, 4), 20);
    const prompt =
      req.mode === 'text'
        ? [
            `Extract a dialogue between two people from this web page text. Keep the original ${lang} sentences; do not translate.`,
            `If the text is not a dialogue, write an ORIGINAL ${lang} dialogue (CEFR ${req.level ?? 'A2'}) about its subject.`,
            `Return ONLY JSON: {"title":"...","speakers":["${speakers[0]}","${speakers[1]}"],"turns":[{"speaker":"A","text":"..."}]} with at most ${MAX_TURNS} turns alternating A/B.`,
            `Text:\n${(req.text ?? '').slice(0, 6000)}`,
          ].join('\n')
        : [
            strict ? strictLine(req.language) : '',
            `Write an ORIGINAL dialogue in ${lang} for learners at CEFR ${req.level ?? 'A2'} about "${req.topic ?? title}" (the topic may be written in Spanish: translate it; every turn MUST be in ${lang}, never in Spanish).`,
            `Speakers: A = ${speakers[0]}, B = ${speakers[1]}. Exactly ${count} short turns alternating A and B, natural everyday language, ONLY in ${lang}.`,
            `Return ONLY JSON: {"title":"(short title in Spanish)","turns":[{"speaker":"A","text":"..."}]}.`,
          ]
            .filter(Boolean)
            .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.5, num_predict: 1200, num_ctx: 8192 },
    });
    let raw: { title?: unknown; speakers?: unknown; turns?: unknown };
    try {
      raw = JSON.parse(res.response ?? '{}') as typeof raw;
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
    // [Filtro]: solo turnos con hablante A/B y texto → el dominio decide, no el LLM
    const turns = (Array.isArray(raw.turns) ? raw.turns : [])
      .map((t) => t as Partial<DraftTurn>)
      .filter(
        (t): t is DraftTurn =>
          (t.speaker === 'A' || t.speaker === 'B') &&
          typeof t.text === 'string' &&
          !!t.text.trim(),
      )
      .slice(0, MAX_TURNS)
      .map((t) => ({ speaker: t.speaker, text: t.text.trim().slice(0, 600) }));
    if (new Set(turns.map((t) => t.speaker)).size < 2)
      throw new ServiceUnavailableException(
        'La IA no pudo armar un diálogo de dos hablantes. Intenta de nuevo o escríbelo a mano.',
      );
    const named =
      Array.isArray(raw.speakers) && raw.speakers.length === 2
        ? this.speakers(raw.speakers.map(String))
        : speakers;
    return {
      title:
        title ||
        (typeof raw.title === 'string' ? raw.title.trim().slice(0, 160) : ''),
      speakers: named,
      turns,
      source: 'llm',
    };
  }

  private speakers(list?: string[]): [string, string] {
    const [a, b] = (list ?? [])
      .map((s) => s.trim().slice(0, 40))
      .filter(Boolean);
    return [a || 'Ana', b || 'Tom'];
  }
}
