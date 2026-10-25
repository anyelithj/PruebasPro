import { Injectable } from '@nestjs/common';
import type ExcelJS from 'exceljs'; // `import type`: exceljs se carga con el primer Excel, no al arrancar
import { renderPdf } from '../../../../shared/pdf/render-pdf';
import { LANGUAGE_LABEL } from '../../../../shared/domain/language.vo';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { headlineText } from '../../domain/headline';
import { CURRICULUM_ITEM_KIND_LABEL_ES } from '../../domain/value-objects/curriculum-item-kind.vo';
import type { CurriculumActor } from '../curriculum-actor';
import type { CurriculumFilterDto } from '../dtos/curriculum-item.dto';
import { ListCurriculumItemsQuery } from './list-curriculum-items.query';
// [Query ExportCurriculum · 2026-10-23]: descarga TODO el contenido filtrado (p. ej. un tema) en PDF, Word, Excel o CSV — antes solo había una plantilla CSV vacía
// [Patrón]: Query Handler (CQRS) + Strategy (un renderizador por formato) + Adapter (contenido JSON → filas planas) | [Principio]: DRY (misma visibilidad por rol que el listado; renderPdf compartido) + OCP (formato nuevo = una entrada)
// [Paradigma]: Funcional (filas puras) + async/await | [Tecnologías]: pdfmake (renderPdf), docx, exceljs — todas con `import()` diferido

export const EXPORT_FORMATS = ['pdf', 'docx', 'xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const MAX_ITEMS = 500; // ponytail: tope de recursos por archivo; paginar el export si un tema supera esto
const BRAND = '7C3AED'; // Morado de marca en las cabeceras

// [Fila plana]: lo que necesita leer un docente o estudiante, sea cual sea el tipo de recurso
interface ExportRow {
  kind: string;
  level: string;
  topic: string;
  text: string;
  ipa: string;
  translation: string;
  details: string;
  examples: string;
}
const HEADERS: Readonly<Record<keyof ExportRow, string>> = {
  kind: 'Tipo',
  level: 'Nivel',
  topic: 'Tema',
  text: 'Texto',
  ipa: 'IPA',
  translation: 'Traducción',
  details: 'Detalles',
  examples: 'Ejemplos',
};
const KEYS = Object.keys(HEADERS) as (keyof ExportRow)[];

// [str]: valor de texto o '' | type guard simple
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// [toRow]: contenido de cualquier tipo → fila | [Paradigma]: función pura
function toRow(item: CurriculumItem): ExportRow {
  const c = item.content as Record<string, unknown>;
  const ipa = (c.ipa as { value?: string } | undefined)?.value ?? '';
  const examples = Array.isArray(c.examples)
    ? (c.examples as Array<Record<string, unknown>>).map((e) => `${str(e.text)}${e.translationEs ? ` — ${str(e.translationEs)}` : ''}`).join('\n')
    : '';
  const criteria = Array.isArray(c.criteria)
    ? (c.criteria as Array<Record<string, unknown>>).map((k) => `${str(k.name)} (${String(k.maxPoints ?? '')} pts)`).join('; ')
    : '';
  return {
    kind: CURRICULUM_ITEM_KIND_LABEL_ES[item.kind] ?? item.kind,
    level: item.level,
    topic: item.topic ?? '',
    text: headlineText(c) || str(c.correct),
    ipa,
    translation: str(c.translationEs) || str(c.targetEs) || str(c.correct),
    details: [str(c.structure), str(c.explanationEs), str(c.ruleEs), str(c.notes), Array.isArray(c.options) ? `Opciones: ${(c.options as string[]).join(' | ')}` : '', Array.isArray(c.answerKey) ? `Respuesta: ${(c.answerKey as string[]).join(' | ')}` : '', criteria]
      .filter(Boolean)
      .join('\n'),
    examples,
  };
}

@Injectable()
export class ExportCurriculumQuery {
  constructor(private readonly list: ListCurriculumItemsQuery) {}

  async execute(filter: CurriculumFilterDto, actor: CurriculumActor, format: ExportFormat): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    // [Visibilidad]: reutiliza el listado → el estudiante solo exporta lo aprobado (Least Privilege)
    const page = await this.list.execute({ ...filter, page: 1, limit: MAX_ITEMS }, actor);
    const rows = page.data.map(toRow);
    const title = [filter.topic, filter.language ? LANGUAGE_LABEL[filter.language] : '', filter.level].filter(Boolean).join(' · ') || 'Recursos';
    const base = `recursos-${(filter.topic ?? 'todos').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'todos'}`;
    const out = await RENDER[format](rows, title);
    return { ...out, filename: `${base}.${format}` };
  }
}

type Rendered = { buffer: Buffer; contentType: string };
// [RENDER]: un renderizador por formato | [Patrón]: Strategy + Registry
const RENDER: Readonly<Record<ExportFormat, (rows: ExportRow[], title: string) => Promise<Rendered>>> = {
  // [CSV]: separador «;» + BOM UTF-8 → Excel en español abre bien las tildes (RFC 4180: comillas dobles escapadas)
  csv: async (rows) => ({
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from('﻿' + [KEYS.map((k) => HEADERS[k]), ...rows.map((r) => KEYS.map((k) => r[k]))].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'utf-8'),
  }),
  // [Excel]: hoja con cabecera morada fija, filtro y texto ajustado
  xlsx: async (rows, title) => {
    const mod = await import('exceljs');
    const wb: ExcelJS.Workbook = new (mod.default ?? mod).Workbook();
    wb.creator = 'AulaDeIdiomas';
    const ws = wb.addWorksheet('Recursos', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = KEYS.map((k) => ({ header: HEADERS[k], key: k, width: k === 'details' || k === 'examples' ? 50 : k === 'text' ? 30 : 16 }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
    ws.eachRow((r, i) => i > 1 && (r.alignment = { wrapText: true, vertical: 'top' }));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: KEYS.length } };
    wb.title = title;
    return { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
  },
  // [Word]: título + tabla con cabecera morada (docx, OOXML sin Word instalado)
  docx: async (rows, title) => {
    const d = await import('docx');
    const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = d;
    // `split('\n')`: cada línea en su párrafo (Word no interpreta \n dentro de un TextRun)
    const cell = (text: string, head = false) =>
      new TableCell({ shading: head ? { fill: BRAND } : undefined, children: (text || ' ').split('\n').map((t) => new Paragraph({ children: [new TextRun({ text: t, bold: head, color: head ? 'FFFFFF' : undefined, size: 18 })] })) });
    const doc = new Document({
      creator: 'AulaDeIdiomas',
      title,
      sections: [
        {
          properties: { page: { size: { orientation: d.PageOrientation.LANDSCAPE } } },
          children: [
            new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [new TableRow({ tableHeader: true, children: KEYS.map((k) => cell(HEADERS[k], true)) }), ...rows.map((r) => new TableRow({ children: KEYS.map((k) => cell(r[k])) }))],
            }),
          ],
        },
      ],
    });
    return { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await Packer.toBuffer(doc) };
  },
  // [PDF]: horizontal, tabla con cabecera morada (renderPdf compartido con reportes y certificados)
  pdf: async (rows, title) => ({
    contentType: 'application/pdf',
    buffer: await renderPdf({
      pageOrientation: 'landscape',
      pageSize: 'A4',
      info: { title },
      defaultStyle: { fontSize: 8 },
      content: [
        { text: title, fontSize: 16, bold: true, color: `#${BRAND}`, margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', '*', 'auto', '*', '*', '*'],
            body: [KEYS.map((k) => ({ text: HEADERS[k], bold: true, color: '#FFFFFF', fillColor: `#${BRAND}` })), ...rows.map((r) => KEYS.map((k) => r[k]))],
          },
          layout: 'lightHorizontalLines',
        },
      ],
    }),
  }),
};
