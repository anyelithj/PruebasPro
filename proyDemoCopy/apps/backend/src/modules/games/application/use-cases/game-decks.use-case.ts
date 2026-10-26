import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import { Role } from '../../../users/domain/value-objects/role.vo';
import {
  GameDeck,
  type DeckItem,
} from '../../domain/entities/game-deck.entity';
import type { GameType } from '../../domain/game-type';
// [GameDecksUseCase · 2026-10-25]: juegos con material propio — listar, crear, editar/publicar, archivar y BORRADOR de palabras con IA (Ollama local)
// Estudiante → solo publicados · Docente → los suyos · Admin → todos | [Patrón]: Use Case + Soft Delete + Filter (el dominio limpia lo que devuelve el LLM) | [Principio]: SRP + mínimo privilegio

export interface DeckActor {
  id: string;
  role: Role;
}
export interface DeckInput {
  gameType: GameType;
  title: string;
  language: string;
  level?: string | null;
  items: DeckItem[];
  status?: 'draft' | 'published';
}

export const MAX_DECK_ITEMS = 60;
const isStaff = (a: DeckActor) =>
  a.role === Role.TEACHER || a.role === Role.ADMIN;

// [cleanItems]: palabras sin vacíos ni duplicados, recortadas | Función pura (también filtra la salida del LLM)
export function cleanItems(raw: unknown): DeckItem[] {
  const seen = new Set<string>();
  const out: DeckItem[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const term = (typeof o.term === 'string' ? o.term : '').trim().slice(0, 80);
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    const opt = (k: string, max: number) =>
      typeof o[k] === 'string' && o[k].trim()
        ? { [k]: o[k].trim().slice(0, max) }
        : {};
    out.push({
      term,
      ...opt('translation', 120),
      ...opt('emoji', 8),
      ...opt('category', 40),
    });
    if (out.length >= MAX_DECK_ITEMS) break;
  }
  return out;
}

@Injectable()
export class GameDecksUseCase {
  private readonly model: string;

  constructor(
    @InjectRepository(GameDeck) private readonly decks: Repository<GameDeck>,
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  list(actor: DeckActor, mine: boolean): Promise<GameDeck[]> {
    const where: FindOptionsWhere<GameDeck> = { archivedAt: IsNull() };
    if (mine && isStaff(actor)) {
      if (actor.role !== Role.ADMIN) where.createdBy = actor.id;
    } else where.status = 'published';
    return this.decks.find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }

  async get(actor: DeckActor, id: string): Promise<GameDeck> {
    const d = await this.decks.findOneBy({ id, archivedAt: IsNull() });
    if (!d || (d.status !== 'published' && !isStaff(actor)))
      throw new NotFoundException('Juego no encontrado');
    return d;
  }

  create(actor: DeckActor, input: DeckInput): Promise<GameDeck> {
    return this.decks.save(
      this.decks.create({
        ...input,
        level: input.level ?? null,
        items: this.checked(input.items),
        status: input.status ?? 'draft',
        createdBy: actor.id,
      }),
    );
  }

  async update(
    actor: DeckActor,
    id: string,
    patch: Partial<DeckInput>,
  ): Promise<GameDeck> {
    const d = await this.editable(actor, id);
    if (patch.title !== undefined) d.title = patch.title.trim();
    if (patch.items !== undefined) d.items = this.checked(patch.items);
    if (patch.status) d.status = patch.status;
    if (patch.level !== undefined) d.level = patch.level;
    return this.decks.save(d);
  }

  async archive(actor: DeckActor, id: string): Promise<void> {
    const d = await this.editable(actor, id);
    d.archivedAt = new Date();
    await this.decks.save(d);
  }

  // [draft]: palabras del tema con traducción al español y emoji (y categoría para «clasificación rápida») → el docente las revisa antes de guardar
  async draft(input: {
    gameType: GameType;
    language: string;
    level?: string;
    topic: string;
    count: number;
    sourceText?: string;
  }): Promise<{ items: DeckItem[] }> {
    const lang = LANGUAGE_NAME_EN[input.language as Language] ?? input.language;
    const count = Math.min(Math.max(input.count, 4), 30);
    const prompt = [
      `List ${count} useful ${lang} words or short expressions (CEFR ${input.level ?? 'A2'}) about "${input.topic}" (the topic may be in Spanish: translate it).`,
      `"term" MUST be in ${lang}; "translation" in Spanish; "emoji" one matching emoji; "category" a one-word group in ${lang}${input.gameType === 'quick_sort' ? ' (use 2-4 different categories)' : ''}.`,
      input.sourceText?.trim()
        ? `Take the words ONLY from this material:\n<<<\n${input.sourceText.trim().slice(0, 6000)}\n>>>`
        : '',
      'Return ONLY JSON: {"items":[{"term":"...","translation":"...","emoji":"...","category":"..."}]}.',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: {
        temperature: 0.4,
        num_predict: 1200,
        num_ctx: input.sourceText ? 8192 : 4096,
      },
    });
    let raw: { items?: unknown };
    try {
      raw = JSON.parse(res.response ?? '{}') as typeof raw;
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió una lista inválida. Intenta de nuevo.',
      );
    }
    return { items: cleanItems(raw.items).slice(0, count) };
  }

  private checked(items: DeckItem[]): DeckItem[] {
    const clean = cleanItems(items);
    if (clean.length < 2)
      throw new BadRequestException('El juego necesita al menos 2 palabras.');
    return clean;
  }

  private async editable(actor: DeckActor, id: string): Promise<GameDeck> {
    const d = await this.decks.findOneBy({ id, archivedAt: IsNull() });
    if (!d) throw new NotFoundException('Juego no encontrado');
    if (actor.role !== Role.ADMIN && d.createdBy !== actor.id)
      throw new ForbiddenException(
        'Solo su autor o un administrador puede cambiarlo.',
      );
    return d;
  }
}
