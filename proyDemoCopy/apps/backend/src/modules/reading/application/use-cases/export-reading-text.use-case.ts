import { Injectable } from '@nestjs/common';
import { renderPdf } from '../../../../shared/pdf/render-pdf';
import { fileName, toTxt, type ExportPart } from '../../domain/reading-export';
import { readingPdf } from '../../infrastructure/export/reading-pdf';
import { GetReadingTextUseCase } from './get-reading-text.use-case';
import { ReadingAccess, type ReadingActor } from './reading-access';
// [UseCase ExportReadingText · Lectura · 2026-10-25]: «Descargar» — TXT (UTF-8) o PDF (pdfmake vía renderPdf compartido) con original + traducción + IPA a elección | [Patrón]: Use Case (Query) + Strategy (formato) | [Principio]: SRP + DRY (mismo renderizador que reportes y certificados) + mínimo privilegio | [Paradigma]: POO + async/await

export interface ExportedFile {
  filename: string;
  contentType: string;
  body: Buffer;
}

@Injectable()
export class ExportReadingTextUseCase {
  constructor(
    private readonly access: ReadingAccess,
    private readonly get: GetReadingTextUseCase,
  ) {}

  async execute(actor: ReadingActor, id: string, format: 'pdf' | 'txt' = 'pdf', include: readonly ExportPart[] = ['translation', 'ipa']): Promise<ExportedFile> {
    const text = await this.access.readable(actor, id);
    const sentences = await this.get.sentencesOf(id);
    if (format === 'txt')
      // BOM UTF-8 (`﻿`): el Bloc de notas de Windows muestra bien tildes e IPA
      return { filename: fileName(text.title, 'txt'), contentType: 'text/plain; charset=utf-8', body: Buffer.from(`﻿${toTxt(text, sentences, include)}`, 'utf8') };
    return { filename: fileName(text.title, 'pdf'), contentType: 'application/pdf', body: await renderPdf(readingPdf(text, sentences, include)) };
  }
}
