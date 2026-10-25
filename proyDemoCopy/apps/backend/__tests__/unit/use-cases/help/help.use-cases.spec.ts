import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FaqIndexSync } from '../../../../src/modules/help/application/use-cases/create-faq.use-case';
import {
  headings,
  visibleRoles,
} from '../../../../src/modules/help/application/use-cases/list-manual.use-case';
import { RateGuideAnswerUseCase } from '../../../../src/modules/help/application/use-cases/rate-guide-answer.use-case';
import {
  parseArticle,
  ReindexManualUseCase,
} from '../../../../src/modules/help/application/use-cases/reindex-manual.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';
// [Suite Help · Sprints 7.10/7.12]: encabezado del manual, reindexado idempotente (huella + FAQ inicial sin duplicar), índice fail-soft, política de rol y valoración que no confía en el cliente | [Patrón]: Test Double (repositorios en memoria + cliente de FastAPI falso) | [Herramienta]: Jest

// [repo]: Repository<T> mínimo en memoria
function repo<T extends object>(rows: T[] = []) {
  const match = (r: T, w: Partial<T>) =>
    Object.entries(w).every(([k, v]) => r[k as keyof T] === v);
  return {
    rows,
    find: jest.fn(async (o?: { where?: Partial<T> }) =>
      rows.filter((r) => !o?.where || match(r, o.where)),
    ),
    create: jest.fn((x: Partial<T>) => ({ ...x }) as T),
    save: jest.fn(async (x: T | T[]) => {
      for (const it of [x].flat() as T[]) if (!rows.includes(it)) rows.push(it);
      return x;
    }),
    remove: jest.fn(async (xs: T[]) =>
      xs.forEach((x) => rows.splice(rows.indexOf(x), 1)),
    ),
    upsert: jest.fn(async () => undefined),
  };
}

const ARTICLE =
  '---\ntitle: Manual del estudiante\nrole: USER\n---\n\n# Manual del estudiante\n\n## Cómo pagar\nCarrito.\n\n## Mi certificado\nPerfil.';

function manualDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'manual-'));
  for (const l of ['es', 'en']) mkdirSync(join(dir, l));
  writeFileSync(join(dir, 'es', 'estudiante.md'), ARTICLE);
  writeFileSync(join(dir, 'es', 'notas.txt'), 'ignorado'); // Solo *.md
  writeFileSync(
    join(dir, 'es', 'faq.json'),
    JSON.stringify([
      {
        question: '¿Cómo pago?',
        answer: 'Con tarjeta.',
        category: 'pagos',
        role: 'USER',
      },
    ]),
  );
  return dir;
}

describe('parseArticle + headings', () => {
  it('lee título y rol del encabezado YAML y quita el encabezado del cuerpo', () => {
    const a = parseArticle('estudiante', 'es', ARTICLE);
    expect(a).toMatchObject({ title: 'Manual del estudiante', role: 'USER' });
    expect(a.body.startsWith('# Manual del estudiante')).toBe(true);
    expect(headings(a.body)).toEqual(['Cómo pagar', 'Mi certificado']);
  });

  it('sin encabezado: rol ALL y título del primer #', () => {
    expect(parseArticle('x', 'en', '# Getting started\ntext')).toMatchObject({
      title: 'Getting started',
      role: 'ALL',
    });
  });
});

describe('ReindexManualUseCase', () => {
  it('publica, siembra la FAQ una sola vez, no reescribe sin cambios y borra lo que ya no existe', async () => {
    process.env.HELP_MANUAL_DIR = manualDir();
    const articles = repo<Record<string, unknown>>([
      { slug: 'viejo', locale: 'es', sha256: 'x' },
    ]);
    const faqs = repo<Record<string, unknown>>();
    const assistant = {
      reindexManual: jest.fn(async () => ({ articles: 1, sections: 3 })),
    };
    const sync = { execute: jest.fn(async () => true) };
    const uc = new ReindexManualUseCase(
      articles as never,
      faqs as never,
      assistant as never,
      sync as never,
    );

    expect(await uc.execute('t')).toMatchObject({
      articles: 1,
      updated: 1,
      removed: 1,
      faqsSeeded: 1,
      sections: 3,
      faqIndexed: true,
    });
    expect(articles.rows.map((a) => a.slug)).toEqual(['estudiante']);
    const [sent] = assistant.reindexManual.mock.calls[0] as unknown as [
      Array<{ slug: string; role: string }>,
    ];
    expect(sent[0]).toMatchObject({ slug: 'estudiante', role: 'USER' });

    expect(await uc.execute('t')).toMatchObject({
      updated: 0,
      removed: 0,
      faqsSeeded: 0,
    }); // Idempotente
    expect(faqs.rows).toHaveLength(1);
    delete process.env.HELP_MANUAL_DIR;
  });

  it('sin la carpeta del manual → 503 explicativo', async () => {
    process.env.HELP_MANUAL_DIR = join(tmpdir(), 'no-existe-manual');
    const uc = new ReindexManualUseCase(
      repo() as never,
      repo() as never,
      {} as never,
      {} as never,
    );
    await expect(uc.execute('t')).rejects.toThrow(/HELP_MANUAL_DIR/);
    delete process.env.HELP_MANUAL_DIR;
  });
});

describe('FaqIndexSync', () => {
  it('envía solo las publicadas en snake_case y, si FastAPI cae, no rompe la escritura', async () => {
    const faqs = repo([
      {
        id: 'f1',
        question: 'q',
        answer: 'a',
        category: 'c',
        role: 'ALL',
        locale: 'es',
        manualSlug: 'm',
        status: 'published',
      },
      {
        id: 'f2',
        question: 'q2',
        answer: 'a2',
        category: 'c',
        role: 'ALL',
        locale: 'es',
        manualSlug: null,
        status: 'archived',
      },
    ]);
    const assistant = {
      embedFaqs: jest
        .fn()
        .mockResolvedValueOnce({ indexed: 1 })
        .mockRejectedValueOnce(new Error('caído')),
    };
    const sync = new FaqIndexSync(faqs as never, assistant as never);
    expect(await sync.execute('t')).toBe(true);
    expect(assistant.embedFaqs).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'f1', manual_slug: 'm' })],
      't',
    );
    expect(await sync.execute('t')).toBe(false);
  });
});

describe('visibleRoles', () => {
  it('cada rol ve lo suyo y lo de todos; ADMIN todo', () => {
    expect(visibleRoles(Role.USER)).toEqual(['ALL', 'USER']);
    expect(visibleRoles(Role.ADMIN)).toHaveLength(4);
  });
});

describe('RateGuideAnswerUseCase', () => {
  const conv = {
    id: 's1',
    user_id: 'u1',
    created_at: '',
    messages: [
      { role: 'user', content: '¿Cómo pago?', timestamp: '' },
      { role: 'assistant', content: 'Con tarjeta.', timestamp: '' },
    ],
  };

  it('guarda pregunta y respuesta REALES de la conversación (no las del cliente) con upsert', async () => {
    const feedback = repo();
    const uc = new RateGuideAnswerUseCase(
      feedback as never,
      { conversation: jest.fn(async () => conv) } as never,
    );
    const row = await uc.execute(
      'u1',
      's1',
      { messageIndex: 1, helpful: false, answeredBy: 'faq' },
      't',
    );
    expect(row).toMatchObject({
      question: '¿Cómo pago?',
      answer: 'Con tarjeta.',
      helpful: false,
    });
    expect(feedback.upsert).toHaveBeenCalledWith(row, [
      'userId',
      'sessionId',
      'messageIndex',
    ]);
  });

  it('un índice que no es respuesta del agente → 400', async () => {
    const uc = new RateGuideAnswerUseCase(
      repo() as never,
      { conversation: jest.fn(async () => conv) } as never,
    );
    await expect(
      uc.execute(
        'u1',
        's1',
        { messageIndex: 2, helpful: true, answeredBy: 'llm' },
        't',
      ),
    ).rejects.toThrow(/respuesta/);
  });
});
