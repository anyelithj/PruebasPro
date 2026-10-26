import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import type { CreateReadingBody } from '../dtos/reading.dto';
import type { ReadingActor } from './reading-access';
import { ReadingContentWriter } from './reading-content.writer';
// [UseCase CreateReadingText · Lectura · 2026-10-25]: guarda un texto como BORRADOR — divide en frases, traduce e IPA por lotes (parcial si FastAPI falla) | [Patrón]: Command + Domain Service (ReadingContentWriter) | [Principio]: SRP + verificación humana (nace en borrador) + Fail-soft | [Paradigma]: POO + async/await

@Injectable()
export class CreateReadingTextUseCase {
  constructor(
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
    private readonly writer: ReadingContentWriter,
  ) {}

  async execute(actor: ReadingActor, body: CreateReadingBody, token: string) {
    const paragraphs = body.paragraphs.map((p) => p.trim()).filter(Boolean);
    if (!paragraphs.length) throw new BadRequestException('El texto está vacío.');
    const text = await this.texts.save(
      this.texts.create({
        title: body.title,
        language: body.language,
        level: body.level,
        genre: body.genre,
        topic: body.topic || null,
        summary: body.summary || null,
        source: body.source ?? 'manual',
        sourceRef: body.sourceRef || null,
        status: 'draft',
        createdBy: actor.id,
      }),
    );
    const { sentences, pending } = await this.writer.write(text, paragraphs, token);
    return { ...text, sentences, pending };
  }
}
