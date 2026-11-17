import { createHash, webcrypto } from 'node:crypto'; // Referencia independiente (createHash) + Web Crypto de Node (jsdom no trae `crypto.subtle`)
import { sameHash, sha256Hex } from '@features/certificates/domain/models/certificates';
// [Caso E · 2026-11-13]: la huella del PDF se calcula en el navegador (Web Crypto) y se compara con la registrada/anclada en Sepolia

describe('Comprobación del PDF en el navegador', () => {
  // `Object.defineProperty` (JS): jsdom expone `crypto` sin `subtle` → se usa la MISMA API Web Crypto que implementa Node
  beforeAll(() => Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true }));
  const bytes = new TextEncoder().encode('%PDF-1.7 certificado AULA-ABCD-2345');

  it('sha256Hex coincide con SHA-256 de referencia', async () => {
    const expected = createHash('sha256').update(bytes).digest('hex');
    await expect(sha256Hex(bytes.slice().buffer)).resolves.toBe(expected);
  });

  it('un solo byte distinto cambia la huella (PDF modificado)', async () => {
    const tampered = bytes.slice();
    tampered[0] = tampered[0]! ^ 1; // `^` (XOR): altera un bit
    expect(await sha256Hex(tampered.buffer)).not.toBe(await sha256Hex(bytes.slice().buffer));
  });

  it('sameHash ignora mayúsculas y el prefijo 0x', () => {
    expect(sameHash('0xABCDEF', 'abcdef')).toBe(true);
    expect(sameHash('abcdef', 'abcdee')).toBe(false);
  });
});
