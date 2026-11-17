import { Injectable } from '@nestjs/common';
import { ReadingAccess, type ReadingActor } from './reading-access';
import { ReadingContentWriter } from './reading-content.writer';
// [UseCase EnrichReadingText · Lectura · 2026-10-25]: «Completar IPA y traducción» — solo las frases a las que les falta (lotes que fallaron al crear); `force` recalcula todas menos las revisadas a mano | [Patrón]: Command + Lazy Backfill | [Principio]: SRP + la corrección manual prevalece + Fail-soft | [Paradigma]: POO + async/await
// [2026-10-27 · DRY]: la lógica de relleno vive en ReadingContentWriter.fill (la comparte el segundo plano del alta/edición); aquí queda el permiso

@Injectable()
export class EnrichReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    private readonly writer: ReadingContentWriter,
  ) {}

  async execute(
    actor: ReadingActor,
    id: string,
    token: string,
    force = false,
  ): Promise<{ updated: number; pending: number }> {
    const text = await this.access.editable(actor, id);
    return this.writer.fill(id, text.language, token, force);
  }
}
