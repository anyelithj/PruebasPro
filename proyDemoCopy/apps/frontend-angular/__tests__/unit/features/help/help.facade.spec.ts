import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { GuideFacade } from '@features/help/application/guide.facade';
import { HelpFacade } from '@features/help/application/help.facade';
import { HelpRepository } from '@features/help/domain/help.repository.port';
import { anchor, filterFaqs, sourceHref, toGuideChunk, type Faq, type GuideChunk } from '@features/help/domain/models/help';
// [Spec HelpFacade + GuideFacade]: filtros en el cliente, guardar que relee, error visible, streaming del Agente Guía con fuentes, valoración y borrado + reglas puras | [Patrón]: Test Double (repositorio falso)

const faq = (over: Partial<Faq> = {}): Faq => ({
  id: 'f1',
  question: '¿Cómo pido mi certificado?',
  answer: 'En Mis certificados.',
  category: 'certificados',
  role: 'USER',
  locale: 'es',
  manualSlug: 'estudiante',
  reviewedAt: '2026-10-16T00:00:00Z',
  ...over,
});

function setup(overrides: Partial<HelpRepository> = {}) {
  const repo = {
    faqs: jest.fn(() => of([faq(), faq({ id: 'f2', question: 'Pagos con tarjeta', answer: 'Stripe', category: 'pagos', role: 'ALL' })])),
    createFaq: jest.fn(() => of(faq())),
    updateFaq: jest.fn(() => of(faq())),
    archiveFaq: jest.fn(() => of(undefined)),
    rate: jest.fn(() => of(undefined)),
    deleteConversation: jest.fn(() => of(undefined)),
    ...overrides,
  } as unknown as HelpRepository;
  TestBed.configureTestingModule({ providers: [HelpFacade, GuideFacade, { provide: HelpRepository, useValue: repo }] });
  return { help: TestBed.inject(HelpFacade), guide: TestBed.inject(GuideFacade), repo };
}

describe('HelpFacade', () => {
  it('filtra al teclear sin pedir al servidor y calcula las categorías', async () => {
    const { help, repo } = setup();
    await help.loadFaqs();
    expect(help.categories()).toEqual(['certificados', 'pagos']);
    help.query.set('CERTIFICADO');
    expect(help.visible().map((f) => f.id)).toEqual(['f1']);
    help.query.set('');
    help.role.set('TEACHER');
    expect(help.visible().map((f) => f.id)).toEqual(['f2']); // Solo las de «todos»
    expect(repo.faqs).toHaveBeenCalledTimes(1);
  });

  it('archivar quita la fila; un error del backend se muestra', async () => {
    const { help } = setup({ createFaq: () => throwError(() => new ApiError(403, 'Forbidden resource')) });
    await help.loadFaqs();
    await help.archiveFaq('f1');
    expect(help.faqs.data()?.map((f) => f.id)).toEqual(['f2']);
    expect(await help.saveFaq(null, { question: 'Hola mundo', answer: 'abc', category: 'x1', role: 'ALL', locale: 'es', manualSlug: '' })).toBe(false);
    expect(help.actionError()).toContain('Forbidden');
  });
});

describe('GuideFacade', () => {
  it('la respuesta crece token a token y recibe sus fuentes; luego se valora', async () => {
    const stream = new Subject<GuideChunk>();
    const { guide, repo } = setup({ ask: jest.fn(() => stream.asObservable()) });
    guide.ask('¿mi certificado?', '/courses');
    expect(repo.ask).toHaveBeenCalledWith({ message: '¿mi certificado?', sessionId: undefined, route: '/courses', locale: 'es', mode: 'guide', language: undefined }); // [2026-10-19]: modo del chatbot
    stream.next({ type: 'session', sessionId: 's1' });
    stream.next({ type: 'token', text: 'Ve a ' });
    stream.next({ type: 'token', text: 'Mis certificados.' });
    stream.next({ type: 'sources', sources: [{ kind: 'manual', id: 'estudiante#mis-certificados', title: 'Mis certificados' }], answeredBy: 'llm' });
    stream.next({ type: 'done' });
    expect(guide.turns()[1]).toMatchObject({ content: 'Ve a Mis certificados.', answeredBy: 'llm' });
    await guide.rate(1, true);
    expect(repo.rate).toHaveBeenCalledWith('s1', 1, true, 'llm', expect.any(String));
    expect(guide.turns()[1].rating).toBe(true);
    await guide.clear();
    expect(repo.deleteConversation).toHaveBeenCalledWith('s1');
    expect(guide.isEmpty()).toBe(true);
  });

  it('si el agente falla quita el turno vacío y muestra el error', () => {
    const { guide } = setup({ ask: () => throwError(() => new ApiError(429, 'ThrottlerException: Too Many Requests')) });
    guide.ask('hola');
    expect(guide.turns()).toHaveLength(1);
    expect(guide.error()).toContain('Too Many');
  });
});

describe('reglas puras de Help', () => {
  it('anchor coincide con el de FastAPI y sourceHref enlaza FAQ y sección', () => {
    expect(anchor('Cómo pagar con ETH')).toBe('como-pagar-con-eth');
    expect(sourceHref({ kind: 'manual', id: 'estudiante#como-pagar', title: '' })).toBe('/ayuda/manual/estudiante#como-pagar');
    expect(sourceHref({ kind: 'faq', id: 'f1', title: '' })).toBe('/ayuda/faq/f1');
  });

  it('toGuideChunk: `sources` válido → trozo; inválido → null', () => {
    expect(toGuideChunk({ type: 'sources', data: { sources: [{ kind: 'faq', id: 'f1', title: 'q', ref: null }], answered_by: 'faq' } })).toMatchObject({ type: 'sources', answeredBy: 'faq' });
    expect(toGuideChunk({ type: 'sources', data: { sources: 'x' } })).toBeNull();
  });

  it('filterFaqs ignora tildes', () => {
    expect(filterFaqs([faq()], { q: 'como pido' })).toHaveLength(1);
  });
});
