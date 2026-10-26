import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import {
  ITEM_TYPES,
  SKILLS,
  type ItemType,
  type Skill,
} from '../../domain/item-type';
import { itemProblem } from '../../domain/item-rules';
import {
  inTargetLanguage,
  strictLine,
} from '../../../../shared/domain/target-language';
import type { ItemInput } from './create-activity.use-case';
// [UseCase GenerateActivityDraft · Sprint 8.12 · RF-114]: pide a Ollama (OllamaClient compartido) un BORRADOR de ítems; no guarda nada: el docente lo revisa en el constructor y decide | [Patrón]: Use Case (Query) + Adapter (OllamaClient) + Filter (descarta ítems incoherentes) | [Principio]: SRP + DRY + revisión humana | [Paradigma]: POO + async/await

export interface DraftRequest {
  language: Language;
  level: string;
  skill: Skill;
  topic: string;
  itemTypes: ItemType[];
  count: number;
  sourceText?: string; // [2026-10-23]: material subido (PDF, imagen, URL…) en el que se basan los ítems
}

@Injectable()
export class GenerateActivityDraftUseCase {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    // [Mismo modelo compacto que los borradores curriculares]
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  // [execute · 2026-10-25]: si la IA responde en español (tema escrito en español) se repite una vez con orden estricta de idioma
  execute(
    req: DraftRequest,
  ): Promise<{ items: ItemInput[]; model: string; discarded: number }> {
    return inTargetLanguage(
      req.language,
      (strict) => this.once(req, strict),
      (r) =>
        r.items
          .map((i) => [i.prompt, ...(i.options ?? [])].join(' '))
          .join(' '),
    );
  }

  private async once(
    req: DraftRequest,
    strict: boolean,
  ): Promise<{ items: ItemInput[]; model: string; discarded: number }> {
    const prompt = [
      strict ? strictLine(req.language) : '',
      `Create ${req.count} ORIGINAL practice items in ${LANGUAGE_NAME_EN[req.language]} (CEFR ${req.level}) about "${req.topic}".`,
      `The topic may be written in Spanish: translate it. "prompt", "options" and "accepted" MUST be written ONLY in ${LANGUAGE_NAME_EN[req.language]}; only "explanation" and "tip" in Spanish.`,
      `Skill: ${req.skill}. Allowed itemType values: ${req.itemTypes.join(', ')}.`,
      'Return ONLY JSON: {"items":[{"itemType":"...","prompt":"...","options":["..."],"accepted":[["..."]],"explanation":"(en español)","tip":"(en español)"}]}.',
      'Rules: multiple_choice → options are the choices and accepted=[[correct option]]; fill_blank → prompt uses ___ for each blank and accepted has one list per blank;',
      'drag_order → options are the shuffled words and accepted=[[words in correct order]]; mark_errors → prompt is a sentence with errors and accepted=[["index of wrong word", ...]] (0-based);',
      'open_answer → accepted=[[model answer]].',
      // [Material del docente · 2026-10-23]: si subió un PDF, una imagen o un enlace, los ítems salen de ESE texto (recortado al contexto del modelo)
      req.sourceText?.trim()
        ? `Base every item ONLY on this material provided by the teacher:\n<<<\n${req.sourceText.trim().slice(0, 6000)}\n>>>`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: {
        temperature: 0.4,
        num_predict: 1500,
        num_ctx: req.sourceText ? 8192 : 4096,
      }, // Más contexto si hay material
    });
    let raw: unknown;
    try {
      raw = JSON.parse(res.response ?? '{}');
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
    const list = Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
    // [Filtro]: solo ítems con tipo permitido y coherentes (las reglas del dominio deciden, no el LLM)
    const items = list
      .map((x) => x as Partial<ItemInput>)
      .filter(
        (x): x is ItemInput =>
          typeof x.prompt === 'string' &&
          (ITEM_TYPES as readonly string[]).includes(String(x.itemType)) &&
          Array.isArray(x.accepted),
      )
      .map((x) => ({
        itemType: x.itemType,
        skill: (SKILLS as readonly string[]).includes(String(x.skill))
          ? x.skill
          : req.skill,
        prompt: x.prompt.slice(0, 2000),
        options: (x.options ?? []).map(String).slice(0, 20),
        accepted: x.accepted.map((a) =>
          Array.isArray(a) ? a.map(String) : [String(a)],
        ),
        explanation: String(x.explanation ?? '').slice(0, 600),
        tip: String(x.tip ?? '').slice(0, 400),
        corrections: {},
      }))
      .filter(
        (x) => req.itemTypes.includes(x.itemType) && itemProblem(x) === null,
      );
    return { items, model: this.model, discarded: list.length - items.length };
  }
}
