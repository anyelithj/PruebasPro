/** @jest-environment node */
// [Test extract-text-pdf · 2026-10-24]: imagen decodificada por pdf.js → PNG en grises para el OCR de PDF escaneados | [Patrón]: Unit Test de función pura
// `@jest-environment node` (docblock de Jest): Buffer/zlib reales de Node, sin jsdom
import { inflateSync } from "node:zlib";
import { toGrayPng } from "@/lib/extract-text-pdf";

// [idat]: extrae y descomprime el bloque IDAT (las filas de píxeles) del PNG generado
const idat = (png: Buffer): Buffer => {
  const at = png.indexOf("IDAT");
  return inflateSync(png.subarray(at + 4, at + 4 + png.readUInt32BE(at - 4)));
};

describe("toGrayPng", () => {
  it("descarta imágenes pequeñas (logos, viñetas) o sin píxeles", () => {
    expect(toGrayPng({ width: 50, height: 50, kind: 2, data: new Uint8Array(50 * 50 * 3) })).toBeNull();
    expect(toGrayPng({ width: 200, height: 200 })).toBeNull();
  });

  it("RGB → PNG válido en escala de grises con el tamaño de la imagen", () => {
    const w = 120, h = 100;
    const data = new Uint8Array(w * h * 3).fill(255); // Todo blanco
    const png = toGrayPng({ width: w, height: h, kind: 2, data })!;
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); // Firma PNG
    expect(png.readUInt32BE(16)).toBe(w); // IHDR: ancho
    expect(png.readUInt32BE(20)).toBe(h); // IHDR: alto
    const rows = idat(png);
    expect(rows.length).toBe((w + 1) * h); // Byte de filtro + 1 byte por píxel
    expect(rows[1]).toBe(255);
  });

  it("1 bit por píxel: bit 1 = blanco, bit 0 = negro (escaneos en blanco y negro)", () => {
    const w = 104, h = 100; // 13 bytes por fila
    const data = new Uint8Array(13 * h).fill(0b10000000); // Primer píxel de cada grupo de 8 blanco
    const rows = idat(toGrayPng({ width: w, height: h, kind: 1, data })!);
    expect([rows[1], rows[2]]).toEqual([255, 0]);
  });
});
