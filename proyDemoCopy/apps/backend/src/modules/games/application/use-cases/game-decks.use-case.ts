import { nounRulePrompt } from '../../../../shared/domain/noun-rule.prompt';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NounGrammarService } from '../../../../shared/noun-grammar/noun-grammar.service';
import { termWithArticle } from '../../../curriculum/domain/content/vocabulary-grammar';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { OllamaClient } from '../../../ai/ollama.client';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
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

// [deckPromptFor · 2026-11-11]: qué pide la IA según el juego — palabras (vocabulario), tarjetas con prohibidas (tabú…), temas (debate, historia…), frases (escucha) u objetivos (role-play)
// [Patrón]: Strategy por familia (tabla de prompts) | [Principio]: OCP + SRP | Función pura
const CARD_GAMES = new Set<string>(['taboo', 'forbidden_word', 'twenty_questions', 'describe_guess']);
const TOPIC_GAMES = new Set<string>(['chained_story', 'debate', 'random_topic', 'speed_speaking']);
const LISTEN_GAMES = new Set<string>(['shadowing', 'partial_dictation', 'listen_reformulate', 'quick_qa']);
const WORD_GAMES = new Set<string>(['flashcards', 'memory', 'bingo', 'quick_sort', 'recovery_drills', 'hangman', ...CARD_GAMES]);
export function deckPromptFor(gameType: string, lang: string, count: number, level: string, topic: string): string[] {
  const head = `(CEFR ${level}) about "${topic}" (the topic may be in Spanish: translate it).`;
  if (CARD_GAMES.has(gameType))
    return [
      `List ${count} concrete ${lang} nouns ${head} Each one is a secret card the learner describes or guesses.`,
      `"term" in ${lang}; "translation" in Spanish; "emoji" one matching emoji; "words": the 3 most obvious ${lang} words to describe it (forbidden in the game), comma-separated.`,
      'Return ONLY JSON: {"items":[{"term":"...","translation":"...","emoji":"...","words":"a, b, c"}]}.',
    ];
  if (TOPIC_GAMES.has(gameType)) {
    const kind =
      gameType === 'debate' ? 'debatable statements (one clear opinion each)' : gameType === 'chained_story' ? 'story openings (first sentence of a story)' : 'speaking prompts (a question or topic to talk about for one minute)';
    return [
      `Write ${count} different ${kind} in ${lang} ${head} Max 15 words each.`,
      `"term" in ${lang}; "translation" in Spanish; "emoji" one matching emoji.`,
      'Return ONLY JSON: {"items":[{"term":"...","translation":"...","emoji":"..."}]}.',
    ];
  }
  if (LISTEN_GAMES.has(gameType))
    return [
      `Write ${count} different natural ${lang} sentences of 6-12 words ${head}`,
      `"term" the sentence in ${lang}; "translation" in Spanish${gameType === 'quick_qa' ? `; "question" a short ${lang} question about one detail of the sentence; "answer" the ONE word of the sentence that answers it` : ''}.`,
      `Return ONLY JSON: {"items":[{"term":"...","translation":"..."${gameType === 'quick_qa' ? ',"question":"...","answer":"..."' : ''}}]}.`,
    ];
  if (gameType === 'role_play')
    return [
      `A role-play in ${lang} ${head} List ${count} goals the learner must achieve in the conversation (e.g. greet, ask the price, pay).`,
      `"term": the goal written in Spanish (imperative, max 8 words); "words": 2-4 ${lang} words or short expressions that show the goal was achieved, comma-separated; "emoji" one matching emoji.`,
      'Return ONLY JSON: {"items":[{"term":"...","words":"a, b","emoji":"..."}]}.',
    ];
  return [
    `List ${count} useful ${lang} words or short expressions ${head}`,
    // [2026-11-16]: el modelo pequeño devolvía «das huevo», «die zanahoria» (español con artículo alemán) y repetía «huevo/huevos» → reglas explícitas
    `"term" MUST be a real ${lang} word (NEVER a Spanish word with a ${lang} article); "translation" its Spanish meaning in SINGULAR; "emoji" the emoji that shows exactly that thing. Every item a DIFFERENT thing (no singular/plural pairs).`,
    // [Fix 2026-11-03 · «partes del cuerpo» → Körper, Sanität, Gespräch]: la categoría era libre → salían grupos ajenos al tema; ahora subgrupos DEL tema, en español
    `"category": a one or two word SUBGROUP inside the topic "${topic}", written in Spanish (e.g. topic body parts → "cabeza", "brazos y manos", "piernas y pies"; topic food → "frutas", "verduras", "bebidas"). Never a category outside the topic${gameType === 'quick_sort' ? '; use 2-4 different categories' : ''}.`,
    'Return ONLY JSON: {"items":[{"term":"...","translation":"...","emoji":"...","category":"..."}]}.',
  ];
}
// [lemma · 2026-11-16]: clave para detectar repetidos y palabras sin traducir → minúsculas, sin artículo inicial ni plural final («las frutas» → «fruta») | Función pura
const ARTICLE = /^(?:(?:el|la|los|las|un|una|der|die|das|ein|eine|le|les|o|os|as|a|an|the|il|lo|gli)\s+|l['’])/u; // `\s+`: «agua» no pierde la «a»
export const lemma = (t: string): string =>
  t.toLowerCase().trim().replace(ARTICLE, '').replace(/(es|s|en|n)$/u, '').trim();

// [fitDeckItems · 2026-11-16]: limpieza de la salida de la IA de un juego de vocabulario | [Patrón]: Pipeline de filtros | [Paradigma]: Funcional (pura)
// 1) fuera el término que es la misma palabra que su traducción (no traducido: «huevo» → «huevo»)
// 2) inglés/alemán: fuera términos con letras del español (ñ, tildes) · alemán: tras der/die/das el sustantivo va en MAYÚSCULA («das huevo» no es alemán)
// 3) sin repetidos por lema del término o de la traducción («das huevo» / «das huevos») · 4) fuera de «Clasificación rápida» la categoría es el tema elegido
export function fitDeckItems(items: DeckItem[], language: string, topic: string, gameType: string): DeckItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => !i.translation || lemma(i.term) !== lemma(i.translation))
    .filter((i) => !(['en', 'de'].includes(language) && /[ñáéíóú¿¡]/iu.test(i.term)))
    .filter((i) => !(language === 'de' && /^(der|die|das)\s+\p{Ll}/u.test(i.term)))
    .filter((i) => {
      const keys = [lemma(i.term), i.translation ? `es:${lemma(i.translation)}` : ''].filter(Boolean);
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    })
    .map((i) => (gameType === 'quick_sort' ? i : { ...i, category: topic.trim().slice(0, 40) }));
}

const isStaff = (a: DeckActor) =>
  a.role === Role.TEACHER || a.role === Role.ADMIN;

// [cleanItems]: palabras sin vacíos ni duplicados, recortadas | Función pura (también filtra la salida del LLM)
export function cleanItems(raw: unknown): DeckItem[] {
  const seen = new Set<string>();
  const out: DeckItem[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const term = (typeof o.term === 'string' ? o.term : '').trim().slice(0, 200);
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
      ...(typeof o.image === 'string' && o.image.length <= 150_000 && /^(https:\/\/\S{4,396}|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/.test(o.image.trim()) ? { image: o.image.trim() } : {}), // [2026-11-03]: miniatura data:image o https
      ...opt('category', 40),
      ...opt('words', 200),
      ...opt('question', 200),
      ...opt('answer', 80),
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
    @Optional() private readonly nouns?: NounGrammarService, // [2026-11-06]: artículo de cada sustantivo al generar
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

  async create(actor: DeckActor, input: DeckInput): Promise<GameDeck> {
    await this.assertUnique(input.title, input.gameType, input.language, input.level ?? null); // [Fix 2026-10-28]: sin juegos repetidos
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
    if (patch.gameType) d.gameType = patch.gameType; // [2026-10-27]: mismo material en otro juego de vocabulario (el DTO solo admite DECK_GAMES)
    if (patch.items !== undefined) d.items = this.checked(patch.items);
    if (patch.status) d.status = patch.status;
    if (patch.level !== undefined) d.level = patch.level;
    // [Fix 2026-10-28 · Sin duplicados]: tras aplicar el PATCH (título, juego o nivel) no puede coincidir con otro juego vigente (el propio no cuenta)
    if (patch.title !== undefined || patch.gameType || patch.level !== undefined)
      await this.assertUnique(d.title, d.gameType, d.language, d.level, d.id);
    return this.decks.save(d);
  }

  // [assertUnique · 2026-10-28]: ámbito = tipo de juego + idioma + nivel (null = sin nivel → `IsNull()`), sin archivados | [Patrón]: Guard Clause | [Principio]: DRY (alta y edición)
  private assertUnique(
    title: string,
    gameType: string, // `string`: la columna de la entidad es varchar (el DTO ya restringe a GameType)
    language: string,
    level: string | null,
    excludeId?: string,
  ): Promise<void> {
    return assertUniqueTitle(
      this.decks,
      title,
      { gameType, language, level: level ?? IsNull(), archivedAt: IsNull() },
      { label: 'un juego', language, level, extra: `de tipo «${gameType}»` },
      excludeId,
    );
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
      ...deckPromptFor(input.gameType, lang, count, input.level ?? 'A2', input.topic),
      nounRulePrompt(input.language), // [2026-11-03 · Regla obligatoria de vocabulario]
      input.sourceText?.trim()
        ? `Take the content ONLY from this material:\n<<<\n${input.sourceText.trim().slice(0, 6000)}\n>>>`
        : '',
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
    // [2026-11-16]: palabras del idioma del juego, sin repetidos y con la categoría del tema (fitDeckItems) · el cliente pide otra tanda si faltan
    const items = (WORD_GAMES.has(input.gameType) && !CARD_GAMES.has(input.gameType)
      ? fitDeckItems(cleanItems(raw.items), input.language, input.topic, input.gameType)
      : cleanItems(raw.items)
    ).slice(0, count);
    // [2026-11-06 · Regla obligatoria de vocabulario]: «Tisch» → «der Tisch» (el prompt solo no basta con el modelo pequeño) | UNA llamada para todo el mazo · fallo → términos tal cual
    if (this.nouns && WORD_GAMES.has(input.gameType)) { // Temas, frases y objetivos no son sustantivos sueltos
      const g = await this.nouns.many(items.map((i) => i.term), input.language);
      const withArticle = items.map((it, k) => ({ ...it, term: termWithArticle(input.language, it.term, g[k] ?? null) }));
      // [2026-11-16]: se vuelve a filtrar → «huevo» suelto + «das» = «das huevo» también se descarta
      return { items: fitDeckItems(withArticle, input.language, input.topic, input.gameType) };
    }
    return { items };
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
