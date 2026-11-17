import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
import { ReadingText } from '../../domain/entities/reading-text.entity';
import type { CreateReadingBody } from '../dtos/reading.dto';
import type { ReadingActor } from './reading-access';
import { ReadingContentWriter } from './reading-content.writer';
import {
  LEVEL_CLASSIFIER,
  type LevelClassifierPort,
} from '../../../dialogues/domain/interfaces/level-classifier.interface'; // [DRY]: el mismo clasificador de Diálogos (RF-126)
import { dictationProblem } from '../../domain/sentence-splitter';
// [UseCase CreateReadingText · Lectura · 2026-10-25]: guarda un texto como BORRADOR — divide en frases y programa traducción e IPA en segundo plano (2026-10-27; antes por lotes en la misma petición) | [Patrón]: Command + Domain Service (ReadingContentWriter) | [Principio]: SRP + verificación humana (nace en borrador) + Fail-soft | [Paradigma]: POO + async/await

@Injectable()
export class CreateReadingTextUseCase {
  constructor(
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
    private readonly writer: ReadingContentWriter,
    @Inject(LEVEL_CLASSIFIER) private readonly classifier: LevelClassifierPort,
  ) {}

  // [levelOf · 2026-11-16 · RF-148]: el nivel elegido manda; sin él se estima del texto · si la IA no responde → 503 accionable (la UI habilita el select)
  private async levelOf(
    body: CreateReadingBody,
    paragraphs: string[],
    token: string,
  ): Promise<string> {
    if (body.level) return body.level;
    try {
      return (
        await this.classifier.classify(
          { language: body.language, turns: paragraphs },
          token,
        )
      ).level;
    } catch {
      throw new ServiceUnavailableException({
        message:
          'No se pudo estimar el nivel del texto. Elige el nivel a mano e inténtalo de nuevo.',
        code: 'LEVEL_ESTIMATE_UNAVAILABLE',
      });
    }
  }

  async execute(actor: ReadingActor, body: CreateReadingBody, token: string) {
    const paragraphs = body.paragraphs.map((p) => p.trim()).filter(Boolean);
    if (!paragraphs.length)
      throw new BadRequestException('El texto está vacío.');
    const kind = body.kind ?? 'reading';
    const tooShort =
      kind === 'dictation' ? dictationProblem(paragraphs, body.language) : null; // [2026-11-16]: ≥ 3 párrafos × ≥ 5 frases
    if (tooShort) throw new BadRequestException(tooShort);
    const level = await this.levelOf(body, paragraphs, token);
    // [Fix 2026-10-28 · Sin duplicados]: otra lectura vigente con el mismo título (normalizado) en idioma + nivel → 409 antes de guardar frases
    await assertUniqueTitle(
      this.texts,
      body.title,
      { language: body.language, level, withdrawnAt: IsNull() },
      { label: 'una lectura', language: body.language, level },
    );
    const text = await this.texts.save(
      this.texts.create({
        title: body.title,
        language: body.language,
        level,
        genre: body.genre,
        kind,
        topic: body.topic || null,
        summary: body.summary || null,
        source: body.source ?? 'manual',
        sourceRef: body.sourceRef || null,
        status: 'draft',
        createdBy: actor.id,
      }),
    );
    // [2026-10-27]: responde en cuanto se guardan las frases; IPA + traducción siguen en segundo plano (`enriching`)
    const { sentences, pending, enriching } = await this.writer.write(
      text,
      paragraphs,
      token,
    );
    return { ...text, sentences, pending, enriching };
  }
}
