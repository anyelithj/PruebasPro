// spreadsheet.util.ts (Express · TypeScript · Node zlib) => leer y escribir hojas de cálculo CSV y Excel (.xlsx) SIN
// dependencias externas (RF-04.3 importación/exportación masiva). Reutilizable por cualquier módulo (catálogo, CRM...).
// - CSV: RFC 4180 (comillas dobles, CRLF), UTF-8 con BOM (Excel abre bien las tildes) y separador "," o ";" detectado.
// - XLSX: un .xlsx es un ZIP con XML (Office Open XML). Se arma/lee el ZIP con "zlib" nativo (deflateRaw/inflateRaw/
//   crc32) y XML mínimo con celdas de texto en línea (inlineStr): sin estilos ni fórmulas => archivo pequeño y seguro.
// Paradigma funcional (funciones puras: datos -> Buffer / Buffer -> filas). Patrones: Adapter (formato <-> filas),
// Strategy (parseSpreadsheet elige el lector por la firma del archivo).
// Seguridad: "CSV/Formula injection" — un texto que empieza por = + - @ se prefija con ' (Excel no lo ejecuta).
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib"; // Módulo nativo de Node.js (crc32 desde Node 22)

export type Cell = string | number | boolean | null | undefined; // Unión de tipos admitidos en una celda
export type SheetRow = Record<string, string>; // Fila leída: encabezado -> valor (siempre texto; el schema Zod lo convierte)

const MAX_ROWS = 5000; // Tope de filas por importación: protege memoria y CPU del servidor (anti DoS)

// safeText => neutraliza la inyección de fórmulas en textos (no toca números)
const safeText = (value: string): string => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const toText = (value: Cell): string => (value === null || value === undefined ? "" : typeof value === "string" ? safeText(value) : String(value));

// ---------------------------------------------------------------- CSV
// toCsv => encabezados + filas -> Buffer UTF-8 con BOM. Comillas solo cuando hacen falta (coma, comilla, salto de línea)
export function toCsv(headers: readonly string[], rows: ReadonlyArray<Record<string, Cell>>): Buffer {
  const escape = (value: string) => (/[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(toText(row[header]))).join(","))];
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8"); // "﻿" => BOM: Excel detecta UTF-8
}

// parseCsv => máquina de estados carácter a carácter (soporta comillas, comillas escapadas "" y saltos dentro de celdas)
export function parseCsv(text: string): SheetRow[] {
  const source = text.replace(/^﻿/, ""); // Quita el BOM si viene
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","; // Excel en español usa ";"
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; } // Comilla escapada
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++; // CRLF cuenta como un salto
      row.push(cell); table.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); table.push(row); }
  return toRecords(table);
}

// toRecords => primera fila = encabezados; filas vacías descartadas; tope MAX_ROWS
function toRecords(table: string[][]): SheetRow[] {
  const [headers = [], ...body] = table;
  const keys = headers.map((header) => header.trim());
  return body
    .filter((cells) => cells.some((value) => value.trim() !== ""))
    .slice(0, MAX_ROWS)
    .map((cells) => Object.fromEntries(keys.map((key, column) => [key, (cells[column] ?? "").trim().replace(/^'(?=[=+\-@])/, "")])));
}

// ---------------------------------------------------------------- ZIP (contenedor del .xlsx)
interface ZipEntry { name: string; data: Buffer }

// zip => crea un ZIP (método deflate, nombres UTF-8). Estructura: [encabezado local + datos]* + directorio central + fin
function zip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    // "Buffer.alloc + write*LE" => campos binarios little-endian según la especificación PKWARE APPNOTE
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// unzip => lee el directorio central (fuente fiable de tamaños) y descomprime cada archivo
function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); // Firma "PK\x05\x06" del registro final
  if (endAt < 0) throw new Error("Archivo Excel inválido (no es un ZIP)");
  const count = buffer.readUInt16LE(endAt + 10);
  let pointer = buffer.readUInt32LE(endAt + 16);
  for (let index = 0; index < count; index++) {
    const method = buffer.readUInt16LE(pointer + 10);
    const size = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localAt = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    const dataAt = localAt + 30 + buffer.readUInt16LE(localAt + 26) + buffer.readUInt16LE(localAt + 28);
    const raw = buffer.subarray(dataAt, dataAt + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw)); // 8 = deflate, 0 = sin comprimir
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

// ---------------------------------------------------------------- XLSX
const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xmlUnescape = (value: string) =>
  value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code))).replace(/&amp;/g, "&");
// columnName => 0 -> "A", 25 -> "Z", 26 -> "AA" (base 26 biyectiva)
const columnName = (index: number): string => (index < 26 ? String.fromCharCode(65 + index) : columnName(Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26)));
const columnIndex = (letters: string): number => [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;

// toXlsx => libro de una hoja "Datos": números como números (Excel puede sumarlos), el resto como texto en línea
export function toXlsx(headers: readonly string[], rows: ReadonlyArray<Record<string, Cell>>): Buffer {
  const cell = (value: Cell, ref: string) =>
    typeof value === "number" && Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(toText(value))}</t></is></c>`;
  const lines = [headers, ...rows.map((row) => headers.map((header) => row[header]))].map(
    (values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, column) => cell(value as Cell, `${columnName(column)}${rowIndex + 1}`)).join("")}</row>`
  );
  const xml = (body: string) => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`, "utf8");
  return zip([
    { name: "[Content_Types].xml", data: xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: "_rels/.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: "xl/workbook.xml", data: xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: "xl/worksheets/sheet1.xml", data: xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${lines.join("")}</sheetData></worksheet>`) },
  ]);
}

// parseXlsx => primera hoja del libro (de este sistema o editada en Excel/LibreOffice/Google Sheets): textos
// compartidos (t="s"), en línea (inlineStr), fórmulas con resultado (t="str") y números
export function parseXlsx(buffer: Buffer): SheetRow[] {
  const files = unzip(buffer);
  const textOf = (fragment: string) => [...fragment.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => xmlUnescape(match[1] ?? "")).join("");
  const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1] ?? ""));
  const sheetName = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0];
  const sheet = sheetName ? files.get(sheetName)?.toString("utf8") ?? "" : "";
  const table: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    // Celda: referencia (columna), atributos (tipo) y contenido; "/>" = celda vacía
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, letters = "A", attributes = "", body = ""] = cellMatch;
      const type = /t="(\w+)"/.exec(attributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      cells[columnIndex(letters)] = type === "s" ? shared[Number(raw)] ?? "" : type === "inlineStr" ? textOf(body) : xmlUnescape(raw);
    }
    table.push(Array.from(cells, (value) => value ?? "")); // Rellena huecos de celdas omitidas
  }
  return toRecords(table);
}

// parseSpreadsheet => Strategy por firma: "PK" (ZIP) => .xlsx; si no, texto CSV
export function parseSpreadsheet(buffer: Buffer): SheetRow[] {
  return buffer.subarray(0, 2).toString("latin1") === "PK" ? parseXlsx(buffer) : parseCsv(buffer.toString("utf8"));
}
