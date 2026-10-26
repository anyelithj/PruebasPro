import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import type { UpdateReadingBody } from '../dtos/reading.dto';
import { ReadingAccess, type ReadingActor } from './reading-access';
import { ReadingContentWriter } from './reading-content.writer';
// [UseCase UpdateReadingText · Lectura · 2026-10-25]: edita metadatos, publica/despublica y, si llegan párrafos, re-divide el texto (conserva traducción/IPA de las frases sin cambios) | [Patrón]: Command + State (draft ↔ published) + Specification (publicable) | [Principio]: SRP + verificación humana | [Paradigma]: POO + async/await

// [publishProblem]: qué impide publicar (null = se puede) | Función pura → probada sin BD
export function publishProblem(t: Pick<ReadingText, 'sentenceCount' | 'title'>): string | null {
  if (!t.sentenceCount) return 'La lectura no tiene frases: añade el texto antes de publicarla.';
  if (t.title.trim().length < 2) return 'La lectura necesita un título.';
  return null;
}

@Injectable()
export class UpdateReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    private readonly writer: ReadingContentWriter,
  ) {}

  async execute(actor: ReadingActor, id: string, body: UpdateReadingBody, token: string) {
    const text = await this.access.editable(actor, id);
    const { paragraphs, status, ...meta } = body;
    // `Object.entries` + filtro: solo los campos enviados (PATCH parcial); '' en opcionales → null
    for (const [k, v] of Object.entries(meta)) if (v !== undefined) Object.assign(text, { [k]: v === '' && k !== 'title' ? null : v });
    let pending: number | undefined;
    if (paragraphs) {
      const clean = paragraphs.map((p) => p.trim()).filter(Boolean);
      if (!clean.length) throw new BadRequestException('El texto está vacío.');
      const previous = await this.sentences.find({ where: { textId: id } });
      ({ pending } = await this.writer.write(text, clean, token, previous)); // Guarda también los metadatos (misma transacción)
    }
    if (status) return this.setStatus(text, status);
    const saved = paragraphs ? text : await this.texts.save(text);
    return pending === undefined ? saved : { ...saved, pending };
  }

  async status(actor: ReadingActor, id: string, status: 'draft' | 'published'): Promise<ReadingText> {
    return this.setStatus(await this.access.editable(actor, id), status);
  }

  private async setStatus(text: ReadingText, status: 'draft' | 'published'): Promise<ReadingText> {
    if (status === 'published') {
      const problem = publishProblem(text);
      if (problem) throw new BadRequestException(problem);
    }
    text.status = status;
    return this.texts.save(text);
  }
}
