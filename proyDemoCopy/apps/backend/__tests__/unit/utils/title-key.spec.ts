import { ConflictException } from '@nestjs/common';
import { titleKey } from '../../../src/shared/domain/title-key';
import { assertUniqueTitle, firstDuplicate } from '../../../src/shared/application/unique-title';
// [Pruebas · 2026-10-28]: regla anti-duplicados por título (normalización + 409 con mensaje en español)

describe('titleKey', () => {
  it('ignora mayúsculas, tildes, puntuación y espacios repetidos', () => {
    expect(titleKey('  El verbo «être»!  ')).toBe('el verbo etre');
    expect(titleKey('El  VERBO etre')).toBe('el verbo etre');
  });
  it('conserva escrituras no latinas (chino, cirílico)', () => {
    expect(titleKey('家庭 · 成员')).toBe('家庭 成员');
    expect(titleKey('Семья!')).toBe('семья');
  });
});

describe('assertUniqueTitle', () => {
  type Row = { id: string; title: string; language?: string }; // [Fix 2026-10-28]: `language` en el tipo → el `where` del ámbito tipa bien (TS)
  const repo = (rows: Row[]) => ({ find: jest.fn().mockResolvedValue(rows) }) as unknown as import('typeorm').Repository<Row>;

  it('lanza 409 con mensaje claro si hay otro registro con el mismo título normalizado', async () => {
    const r = repo([{ id: 'a', title: 'La Familia' }]);
    const p = assertUniqueTitle(r, 'la familia.', { language: 'fr' }, { label: 'una canción', language: 'fr', level: 'A1' });
    await expect(p).rejects.toThrow(ConflictException);
    await expect(p).rejects.toThrow('Ya existe una canción con el título «La Familia» para francés A1');
  });
  it('en edición no cuenta el propio registro', async () => {
    const r = repo([{ id: 'a', title: 'La Familia' }]);
    await expect(assertUniqueTitle(r, 'La familia', {}, { label: 'una canción' }, 'a')).resolves.toBeUndefined();
  });
  it('firstDuplicate: título vacío nunca es duplicado', () => {
    expect(firstDuplicate([{ id: 'a', title: '' }], '  ')).toBeNull();
  });
});
