import { Readable } from 'stream';
import { GetInvoiceUseCase } from '../../../../src/modules/payments/application/use-cases/get-invoice.use-case';
import { invoiceNumber, invoicePdf } from '../../../../src/modules/payments/infrastructure/invoices/invoice-pdf';
import { parseScript } from '../../../../src/modules/dialogues/application/use-cases/draft-dialogue.use-case';
import { evaluateRound } from '../../../../src/modules/games/application/strategies/game-evaluator.strategy';
import { TopicTitleUseCase } from '../../../../src/modules/vocabulary/application/use-cases/topic-title.use-case';
import { MirroredObjectStore } from '../../../../src/shared/storage/mirrored-object.store';
import type { ObjectStore } from '../../../../src/shared/storage/object-store';
import type { LanguageToolsPort } from '../../../../src/shared/domain/interfaces/language-tools.interface';
// [Suite correcciones 2026-10-19]: guion de diálogo desde una URL, «respuesta rápida» con cifras, título de tema traducido con caché y almacén nube + copia local | [Patrón]: Test Double (puertos en memoria) | [Herramienta]: Jest

const store = (over: Partial<ObjectStore> = {}): ObjectStore => ({
  put: jest.fn(async () => undefined),
  size: jest.fn(async () => 4),
  open: jest.fn(async () => Readable.from(['nube'])),
  remove: jest.fn(async () => undefined),
  signedUrl: jest.fn(async () => 'https://bucket/firmada'),
  ...over,
});

describe('Correcciones 2026-10-19', () => {
  it('parseScript: lee «Nombre: frase» de una página y asigna A/B a los dos primeros hablantes', () => {
    const page = ['Diálogo en el restaurante', 'Ana: Hello! A table for two, please.', 'Tom: Sure, follow me.', '- Ana: Thank you!', 'Nota del autor: …'].join('\n');
    const r = parseScript(page)!;
    expect(r.speakers).toEqual(['Ana', 'Tom']);
    expect(r.turns.map((t) => t.speaker)).toEqual(['A', 'B', 'A']); // «Nota del autor» sería un tercer hablante → se ignora
    expect(r.turns[0]?.text).toBe('Hello! A table for two, please.');
    expect(parseScript('Un texto sin guion.')).toBeNull();
  });

  it('respuesta rápida: «8» vale lo mismo que «eight» y «2 years» que «two years»', () => {
    const content = { lines: [{ text: 'I take the bus at eight', answer: 'eight' }, { text: 'She has been learning French for two years', answer: 'two years' }] };
    expect(evaluateRound('quick_qa', { answer: 'at 8', lineIndex: 0 }, content as never).correct).toBe(true);
    expect(evaluateRound('quick_qa', { answer: '2 years', lineIndex: 1 }, content as never).correct).toBe(true);
    expect(evaluateRound('quick_qa', { answer: 'French', lineIndex: 1 }, content as never).correct).toBe(false);
  });

  it('título del tema: traduce del español al idioma estudiado, añade IPA y lo guarda en caché', async () => {
    const tools = {
      translate: jest.fn(async () => ({ translation: 'The family' })),
      ipa: jest.fn(async () => ({ ipa: 'ðə ˈfæmɪli', ipa_us: 'ðə ˈfæməli', engine: 'espeak-ng' })),
    } as unknown as LanguageToolsPort;
    const uc = new TopicTitleUseCase(tools);
    await expect(uc.execute('La familia', 'en', 't')).resolves.toEqual({ text: 'The family', ipa: 'ðə ˈfæmɪli', ipaUs: 'ðə ˈfæməli', translationEs: 'La familia' });
    await uc.execute('la familia', 'en', 't'); // Misma clave (sin mayúsculas) → caché
    expect(tools.translate).toHaveBeenCalledTimes(1);
  });

  it('almacén espejo: guarda en la nube y en disco; si la nube falla, sirve la copia local', async () => {
    const cloud = store({ open: jest.fn(async () => Promise.reject(new Error('Request has expired'))), signedUrl: jest.fn(async () => Promise.reject(new Error('NotFound'))) });
    const local = store({ open: jest.fn(async () => Readable.from(['disco'])) });
    const m = new MirroredObjectStore(cloud, local);
    await m.put('k', Buffer.from('x'), 'application/pdf');
    expect(cloud.put).toHaveBeenCalled();
    expect(local.put).toHaveBeenCalled();
    const chunks: string[] = [];
    for await (const c of await m.open('k')) chunks.push(String(c));
    expect(chunks.join('')).toBe('disco');
    await expect(m.signedUrl('k', { filename: 'a.pdf', contentType: 'application/pdf', disposition: 'inline' })).resolves.toBeNull(); // → el backend sirve el flujo
  });
});

describe('Factura (Sprint 2.6)', () => {
  it('genera un PDF con número estable y solo para órdenes pagadas o reembolsadas', async () => {
    const order = { id: '1a2b3c4d-0000-0000-0000-000000000000', userId: 'u1', status: 'paid', items: [{ courseId: 'c', title: 'Inglés A1', amountMinor: 56300 }], totalMinor: 56300, currency: 'usd', paidAt: new Date('2026-10-19T00:00:00Z'), createdAt: new Date('2026-10-18T00:00:00Z') };
    expect(invoiceNumber(order as never)).toBe('AULA-F-2026-1A2B3C4D');
    const pdf = await invoicePdf(order as never, 'ana@x.com');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const uc = (o: object) => new GetInvoiceUseCase({ execute: jest.fn(async () => o) } as never);
    const user = { sub: 'u1', role: 'USER', email: 'ana@x.com' } as never;
    await expect(uc(order).execute(user, order.id)).resolves.toMatchObject({ filename: 'factura-AULA-F-2026-1A2B3C4D.pdf' });
    await expect(uc({ ...order, status: 'pending' }).execute(user, order.id)).rejects.toThrow(/pagada/);
  });
});
