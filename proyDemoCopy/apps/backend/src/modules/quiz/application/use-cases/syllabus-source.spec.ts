import { syllabusSource } from './exams.service';

describe('syllabusSource', () => {
  it('incluye el índice y un trozo de cada subtema aunque el curso sea largo', () => {
    const content = ['## Tema 1', '### Verbo to be', 'x'.repeat(9000), '### Pronombres', 'y'.repeat(9000), '## Tema 2', '### Presente simple', 'z'.repeat(9000)].join('\n');
    const out = syllabusSource(content, 'desc');
    expect(out.length).toBeLessThanOrEqual(6000);
    for (const t of ['Verbo to be', 'Pronombres', 'Presente simple']) expect(out).toContain(`- ${t}`);
    expect(out).toContain('### Presente simple\nz');
  });
  it('sin encabezados → descripción + contenido', () => {
    expect(syllabusSource('texto', 'desc')).toBe('desc\n\ntexto');
  });
});
