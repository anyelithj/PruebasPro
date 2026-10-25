import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Language,
  LANGUAGE_LABEL,
  DEFAULT_VARIANT,
} from '../../../shared/domain/language.vo';
import { languageMismatch } from '../domain/content/curriculum-content.schema';
import { CurriculumTopicLabel } from '../domain/entities/curriculum-topic-label.entity';
import {
  CURRICULUM_LLM,
  type CurriculumLlm,
} from '../domain/interfaces/curriculum-llm.interface';
import { slugify } from '../domain/slug';
import type {
  TopicLabelView,
  UpsertTopicLabelDto,
} from './dtos/curriculum-item.dto';
// [Nombre del tema en el idioma]: leer, guardar y sugerir con IA ("La ropa" → "Clothes" /kləʊðz/ · sustantivo) | [Patrón]: Service (Command + Query) + Port/Adapter (LLM) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await

// [toView]: entidad → respuesta pública | [Paradigma]: Funcional (pura)
const toView = (l: CurriculumTopicLabel): TopicLabelView => ({
  label: l.label,
  ipa: l.ipa ? { value: l.ipa, variant: l.ipaVariant ?? '' } : null,
  partOfSpeech: l.partOfSpeech,
});

@Injectable()
export class TopicLabelService {
  constructor(
    @InjectRepository(CurriculumTopicLabel)
    private readonly labels: Repository<CurriculumTopicLabel>,
    @Inject(CURRICULUM_LLM) private readonly llm: CurriculumLlm,
  ) {}

  // [get]: nombre del tema en un idioma (null si aún no se definió)
  async get(language: Language, topic: string): Promise<TopicLabelView | null> {
    const found = await this.labels.findOne({
      where: { language, topicSlug: slugify(topic) },
    });
    return found ? toView(found) : null;
  }

  // [many]: varios temas en una sola consulta (tarjetas de /resources) | `In` (TypeORM) → WHERE … IN (…)
  async many(
    pairs: ReadonlyArray<{ language: Language; topic: string }>,
  ): Promise<Map<string, TopicLabelView>> {
    const map = new Map<string, TopicLabelView>();
    if (!pairs.length) return map;
    const rows = await this.labels.find({
      where: {
        topicSlug: In([...new Set(pairs.map((p) => slugify(p.topic)))]),
      },
    });
    for (const r of rows) map.set(`${r.language}|${r.topicSlug}`, toView(r));
    return map;
  }

  // [upsert]: crea o actualiza (una fila por idioma + tema) | valida la coherencia de idioma y la variante IPA
  async upsert(
    dto: UpsertTopicLabelDto,
    actorId: string,
  ): Promise<TopicLabelView> {
    const topicSlug = slugify(dto.topic);
    if (!topicSlug) throw new BadRequestException('El tema no es válido.');
    const variant = dto.ipa
      ? dto.ipaVariant?.trim() || DEFAULT_VARIANT[dto.language]
      : null;
    const mismatch = languageMismatch(dto.language, {
      text: dto.label,
      ...(variant ? { ipa: { value: dto.ipa, variant } } : {}),
    });
    if (mismatch) throw new UnprocessableEntityException(mismatch);
    const existing = await this.labels.findOne({
      where: { language: dto.language, topicSlug },
    });
    const saved = await this.labels.save(
      this.labels.create({
        ...(existing ?? {}),
        language: dto.language,
        topicSlug,
        label: dto.label.trim(),
        ipa: dto.ipa?.trim() || null,
        ipaVariant: variant,
        partOfSpeech: dto.partOfSpeech?.trim() || null,
        updatedBy: actorId,
      }),
    );
    return toView(saved);
  }

  // [suggest]: la IA propone el nombre, la IPA y el tipo de palabra (borrador: el autor lo revisa)
  async suggest(language: Language, topic: string): Promise<TopicLabelView> {
    const lang = LANGUAGE_LABEL[language];
    const variant = DEFAULT_VARIANT[language];
    const prompt = [
      `Eres profesor de ${lang} para hispanohablantes.`,
      `Traduce al ${lang} el nombre del tema de estudio "${topic}" tal como aparecería en un libro de texto (palabra o frase corta, sin artículos innecesarios).`,
      `Da su transcripción IPA en la variante ${variant}${language === Language.EN ? ' (inglés británico no rótico)' : ''} y su tipo de palabra en español (sustantivo, verbo, adjetivo, adverbio o expresión).`,
      'Responde SOLO con JSON: {"label": "...", "ipa": "/.../", "partOfSpeech": "..."}',
    ].join('\n');
    const { data } = await this.llm.generateJson(prompt, 120);
    const raw = (data ?? {}) as {
      label?: unknown;
      ipa?: unknown;
      partOfSpeech?: unknown;
    };
    const label =
      typeof raw.label === 'string' ? raw.label.trim().slice(0, 160) : '';
    if (!label || languageMismatch(language, { text: label }))
      throw new UnprocessableEntityException(
        'La IA no devolvió un nombre válido en el idioma. Escríbelo a mano.',
      );
    return {
      label,
      ipa:
        typeof raw.ipa === 'string' && raw.ipa.trim()
          ? { value: raw.ipa.trim().slice(0, 200), variant }
          : null,
      partOfSpeech:
        typeof raw.partOfSpeech === 'string'
          ? raw.partOfSpeech.trim().toLowerCase().slice(0, 40)
          : null,
    };
  }
}
