import { Injectable } from '@nestjs/common';
import { renderPdf } from '../../../../shared/pdf/render-pdf';
import {
  fileName,
  groupParagraphs,
  headerLine,
  toTxt,
  type ExportPart,
  type ExportSentence,
  type ExportText,
} from '../../domain/reading-export';
import { readingPdf } from '../../infrastructure/export/reading-pdf';
import { GetReadingTextUseCase } from './get-reading-text.use-case';
import { ReadingAccess, type ReadingActor } from './reading-access';
// [UseCase ExportReadingText · Lectura · 2026-10-25]: «Descargar» — TXT (UTF-8) o PDF (pdfmake vía renderPdf compartido) con original + traducción + IPA a elección | [Patrón]: Use Case (Query) + Strategy (formato) | [Principio]: SRP + DRY (mismo renderizador que reportes y certificados) + mínimo privilegio | [Paradigma]: POO + async/await

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// [readingDocx · 2026-11-02]: Word (sustituye al TXT en el lector) — título, cabecera y cada frase con IPA (fuente que cubre los símbolos) y traducción | `import()` diferido como en Currículo
async function readingDocx(
  t: ExportText,
  sentences: readonly ExportSentence[],
  include: readonly ExportPart[],
): Promise<Buffer> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } =
    await import('docx');
  const withTr = include.includes('translation');
  const withIpa = include.includes('ipa');
  const body = groupParagraphs(sentences).flatMap((para) =>
    withTr || withIpa
      ? para.flatMap((s) => [
          new Paragraph({
            children: [new TextRun({ text: s.text, size: 24 })],
          }),
          ...(withIpa && s.ipa
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `/${s.ipa}/`,
                      font: 'Segoe UI',
                      size: 18,
                      color: '555555',
                    }),
                  ],
                }),
              ]
            : []),
          ...(withTr && s.translation
            ? [
                new Paragraph({
                  spacing: { after: 160 },
                  children: [
                    new TextRun({
                      text: s.translation,
                      italics: true,
                      size: 20,
                      color: '333333',
                    }),
                  ],
                }),
              ]
            : []),
        ])
      : [
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: para.map((s) => s.text).join(' '),
                size: 24,
              }),
            ],
          }),
        ],
  );
  const doc = new Document({
    title: t.title,
    sections: [
      {
        children: [
          new Paragraph({ text: t.title, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [
              new TextRun({ text: headerLine(t), color: '666666', size: 20 }),
            ],
          }),
          ...(t.summary
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: t.summary, italics: true, size: 20 }),
                  ],
                }),
              ]
            : []),
          ...body,
          ...(t.sourceRef
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Fuente: ${t.sourceRef}`,
                      size: 16,
                      color: '777777',
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

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

  async execute(
    actor: ReadingActor,
    id: string,
    format: 'pdf' | 'txt' | 'docx' = 'pdf',
    include: readonly ExportPart[] = ['translation', 'ipa'],
  ): Promise<ExportedFile> {
    const text = await this.access.readable(actor, id);
    const sentences = await this.get.sentencesOf(id);
    if (format === 'txt')
      // BOM UTF-8 (`﻿`): el Bloc de notas de Windows muestra bien tildes e IPA
      return {
        filename: fileName(text.title, 'txt'),
        contentType: 'text/plain; charset=utf-8',
        body: Buffer.from(`﻿${toTxt(text, sentences, include)}`, 'utf8'),
      };
    if (format === 'docx')
      return {
        filename: fileName(text.title, 'docx'),
        contentType: DOCX,
        body: await readingDocx(text, sentences, include),
      };
    return {
      filename: fileName(text.title, 'pdf'),
      contentType: 'application/pdf',
      body: await renderPdf(readingPdf(text, sentences, include)),
    };
  }
}
