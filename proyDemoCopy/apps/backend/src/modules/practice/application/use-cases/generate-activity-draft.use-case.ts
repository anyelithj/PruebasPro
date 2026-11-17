import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { NounGrammarService } from '../../../../shared/noun-grammar/noun-grammar.service';
import { nounRulePrompt } from '../../../../shared/domain/noun-rule.prompt';
import { termWithArticle } from '../../../curriculum/domain/content/vocabulary-grammar';
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
  looksSpanish,
  strictLine,
  wrongLanguage,
} from '../../../../shared/domain/target-language';
import type { ItemInput } from './create-activity.use-case';
import { listOf, parseJsonLoose } from '../../../../shared/domain/llm-json'; // [Fix 2026-10-28]: lectura tolerante compartida (DRY con Diálogos)
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

// [Presupuesto · Fix 2026-10-28]: plazo por inferencia + total (antes sin plazo propio: hasta 600 s del OllamaClient > 300 s del BFF → «El servidor no responde»)
// y UNA ronda de relleno si la IA devolvió menos ítems válidos que los pedidos (antes se entregaban 3 de 10 sin intentarlo de nuevo) | [Patrón]: Deadline + Top-up
// [Fix 2026-10-31]: POR LOTES → antes se pedían todos los ítems en una inferencia y, con el modelo en CPU, 100 s no alcanzaban: 504 y nada que revisar. Ahora cada lote entra en plazo y un corte conserva lo ya generado
// 150 s/270 s: mismo orden que COURSE_DRAFT_TIMEOUT_MS y siempre < 300 s de `headersTimeout` del BFF (undici) | [Patrón]: Chunking + Fail Soft
// [Fix 2026-10-31]: 150 s → 240 s. Medido en este equipo: 4 tokens/s y carga en frío de 1–2 min con poca RAM → la primera tanda agotaba el plazo con el modelo aún cargando
export const PRACTICE_ATTEMPT_MS = 240_000;
export const PRACTICE_BUDGET_MS = 270_000;
export const PRACTICE_BATCH = 5; // Ítems por inferencia
const MIN_TOPUP_WINDOW_MS = 45_000; // Sin este margen no se empieza otra inferencia
// [promptKey]: enunciado normalizado (minúsculas, sin tildes ni signos) → detecta ítems repetidos entre rondas | Función pura
// [unlabel]: quita el rótulo «(en español)» que el modelo copiaba del formato | Función pura
const unlabel = (v: unknown): string => String(v ?? '').replace(/^\s*\(en español\)\s*/i, '').trim();
// [offLanguage · 2026-11-06]: ítem cuyo enunciado + opciones salió en español u otro idioma (el modelo mezclaba: alemán pedido → enunciados en español) → se descarta | Función pura
export const offLanguage = (i: Pick<ItemInput, 'prompt' | 'options'>, language: string): boolean => {
  const text = [i.prompt, ...(i.options ?? [])].join(' ');
  return (language !== 'es' && looksSpanish(text)) || wrongLanguage(text, language) !== null;
};
const promptKey = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

type DraftOutput = { items: ItemInput[]; model: string; discarded: number; offLanguage?: number };

@Injectable()
export class GenerateActivityDraftUseCase {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
    @Optional() private readonly nouns?: NounGrammarService, // [2026-11-06]: artículo de los sustantivos en las opciones
  ) {
    // [Mismo modelo compacto que los borradores curriculares]
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  // [execute · 2026-10-25]: si la IA responde en español (tema escrito en español) se repite una vez con orden estricta de idioma
  // [Fix 2026-10-28]: + ronda de relleno con lo que FALTA (sin repetir enunciados) mientras quede presupuesto → se acerca a la cantidad pedida
  async execute(req: DraftRequest): Promise<DraftOutput> {
    const deadline = Date.now() + PRACTICE_BUDGET_MS; // `Date.now()` (JS): plazo absoluto de la petición
    const left = () => deadline - Date.now();
    let initial: DraftOutput | null = null; // Primer intento → se devuelve si no queda tiempo para el reintento por idioma (mejor revisar que fallar)
    const first = await inTargetLanguage(
      req.language,
      async (strict) => {
        if (strict && initial && left() < MIN_TOPUP_WINDOW_MS) return initial;
        const out = await this.once({ ...req, count: Math.min(req.count, PRACTICE_BATCH) }, strict, [], Math.min(PRACTICE_ATTEMPT_MS, left()));
        initial ??= out; // `??=` (ES2021): solo guarda el primero
        return out;
      },
      (r) =>
        r.items
          .map((i) => [i.prompt, ...(i.options ?? [])].join(' '))
          .join(' '),
    );
    const items = [...first.items];
    let discarded = first.discarded;
    const seen = new Set(items.map((i) => promptKey(i.prompt))); // `Set` (ES2015): sin enunciados repetidos
    let strict = (first.offLanguage ?? 0) > 0; // [2026-11-06]: hubo ítems en otro idioma → los lotes siguientes llevan la orden estricta
    // [Lotes siguientes]: hasta completar la cantidad o agotar el presupuesto | sin enunciados nuevos o con un fallo se entrega lo que haya
    while (items.length < req.count && left() >= MIN_TOPUP_WINDOW_MS) {
      let more: DraftOutput;
      try {
        more = await this.once(
          { ...req, count: Math.min(req.count - items.length, PRACTICE_BATCH) },
          strict,
          items.map((i) => i.prompt),
          Math.min(PRACTICE_ATTEMPT_MS, left()),
        );
      } catch {
        break; // [Fail Soft]: los lotes ya generados se entregan igualmente
      }
      discarded += more.discarded;
      strict ||= (more.offLanguage ?? 0) > 0;
      const extra = more.items.filter((i) => {
        const k = promptKey(i.prompt);
        return !seen.has(k) && Boolean(seen.add(k));
      });
      if (!extra.length) break;
      items.push(...extra);
    }
    const out = items.slice(0, req.count);
    if (req.skill === 'vocabulary' && this.nouns) await this.withArticles(out, req.language);
    return { items: out, model: first.model, discarded };
  }

  // [withArticles · 2026-11-06 · Regla obligatoria de vocabulario]: opción múltiple con opciones de UNA palabra («Mutter») → «die Mutter» en opciones Y respuesta (misma forma → la corrección sigue cuadrando)
  // Huecos y ordenar no se tocan (el artículo puede estar ya en la frase) | UNA llamada para todas las palabras · fallo → igual
  private async withArticles(items: ItemInput[], language: string): Promise<void> {
    const single = (w: string) => w.trim() !== '' && !/\s/.test(w.trim());
    const mc = items.filter((i) => i.itemType === 'multiple_choice' && (i.options ?? []).length > 0 && (i.options ?? []).every(single));
    const words = [...new Set(mc.flatMap((i) => i.options ?? []).map((w) => w.trim()))];
    if (!words.length) return;
    const g = await this.nouns!.many(words, language);
    const fix = new Map(words.map((w, k) => [w, termWithArticle(language, w, g[k] ?? null)]));
    for (const i of mc) {
      i.options = (i.options ?? []).map((o) => fix.get(o.trim()) ?? o);
      i.accepted = i.accepted.map((list) => list.map((a) => fix.get(a.trim()) ?? a));
    }
  }

  private async once(
    req: DraftRequest,
    strict: boolean,
    avoid: string[], // [Fix 2026-10-28]: enunciados ya propuestos → la ronda de relleno no los repite
    timeoutMs: number, // [Fix 2026-10-28]: plazo de ESTA inferencia (OllamaClient → 504 claro)
  ): Promise<DraftOutput> {
    const name = LANGUAGE_NAME_EN[req.language];
    const prompt = [
      strict ? strictLine(req.language) : '',
      `Create ${req.count} ORIGINAL practice items for learners of ${name} (CEFR ${req.level}) about the topic "${req.topic}".`,
      // [Fix 2026-11-06]: el modelo mezclaba idiomas (enunciados en español, explicación en alemán) → regla explícita por campo + ejemplo con marcadores de idioma
      `The topic may be written in Spanish: translate it to ${name}. Language per field: "prompt", "options" and "accepted" ONLY in ${name} (never Spanish); "explanation" and "tip" ONLY in Spanish.`,
      `Skill: ${req.skill}. Allowed itemType values: ${req.itemTypes.join(', ')}.`,
      nounRulePrompt(req.language), // [2026-11-06 · Regla obligatoria de vocabulario]
      `Return ONLY JSON: {"items":[{"itemType":"...","prompt":"<${name} sentence>","options":["<${name} word>"],"accepted":[["<${name} answer>"]],"explanation":"<explicación breve en español>","tip":"<consejo en español>"}]}.`,
      'Rules: multiple_choice → options are the choices and accepted=[[correct option]]; fill_blank → prompt uses ___ for each blank and accepted has one list per blank;',
      'drag_order → options are the shuffled words and accepted=[[words in correct order]]; mark_errors → prompt is a sentence with errors and accepted=[["index of wrong word", ...]] (0-based);',
      'open_answer → accepted=[[model answer]].',
      // [Material del docente · 2026-10-23]: si subió un PDF, una imagen o un enlace, los ítems salen de ESE texto (recortado al contexto del modelo)
      req.sourceText?.trim()
        ? `Base every item ONLY on this material provided by the teacher:\n<<<\n${req.sourceText.trim().slice(0, 6000)}\n>>>`
        : '',
      avoid.length
        ? `Do NOT repeat these existing items: ${avoid.slice(-20).map((a) => a.slice(0, 120)).join(' | ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: {
        temperature: 0.4,
        num_predict: Math.min(1500, 200 + req.count * 220), // [Fix 2026-10-31]: tope según la tanda → 1500 tokens a 4 tokens/s son 375 s, más que el plazo
        num_ctx: req.sourceText ? 8192 : 4096,
      }, // Más contexto si hay material
      timeoutMs,
    });
    // [Fix 2026-10-28]: lectura tolerante (JSON envuelto en texto, lista suelta u otro nombre de lista) antes de rendirse
    const raw = parseJsonLoose(res.response ?? '{}');
    if (raw === undefined)
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido (sin JSON legible). Intenta de nuevo o pide menos ítems.',
      );
    const list = listOf(raw, 'items');
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
        explanation: unlabel(x.explanation).slice(0, 600),
        tip: unlabel(x.tip).slice(0, 400),
        corrections: {},
      }))
      .filter(
        (x) => req.itemTypes.includes(x.itemType) && itemProblem(x) === null,
      );
    const inLang = items.filter((x) => !offLanguage(x, req.language));
    return {
      items: inLang,
      model: this.model,
      discarded: list.length - inLang.length,
      offLanguage: items.length - inLang.length,
    };
  }
}
