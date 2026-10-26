import { Inject, Injectable } from '@nestjs/common';
import {
  READING_DRAFT,
  type ReadingDraft,
  type ReadingDraftPort,
  type ReadingDraftRequest,
} from '../../domain/interfaces/reading-draft.interface';
// [UseCase DraftReading · Lectura · 2026-10-25]: BORRADOR de un texto (IA local por género, nivel, tema y longitud; opcionalmente basado en material importado) — no guarda nada: el docente revisa y luego POST /reading/texts | [Patrón]: Use Case (Query) + Port (READING_DRAFT) | [Principio]: DIP + revisión humana | [Paradigma]: POO

@Injectable()
export class DraftReadingUseCase {
  constructor(@Inject(READING_DRAFT) private readonly ai: ReadingDraftPort) {}

  execute(req: Omit<ReadingDraftRequest, 'words'> & { words?: number }): Promise<ReadingDraft> {
    return this.ai.draft({ ...req, words: req.words ?? 180 }); // 180 palabras ≈ 1–2 minutos de lectura
  }
}
