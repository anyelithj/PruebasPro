import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AskGuideUseCase, toSse } from '../../../../src/modules/help/application/use-cases/ask-guide.use-case';
import { answerWithoutLlm, sections } from '../../../../src/modules/help/domain/guide-fallback';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';
// [Suite Agente Guía sin IA · 2026-10-27]: FastAPI/Ollama caídos → respuesta desde la FAQ y el manual (no 503), mismo protocolo SSE y aviso `degraded`
// | [Patrón]: Test Double (repositorios y cliente simulados) | [Herramienta]: Jest

const FAQS = [
  { id: 'f1', question: '¿Cómo cambio mi contraseña?', answer: 'En Mi perfil → Seguridad → Cambiar contraseña.', manualSlug: 'estudiante' },
  { id: 'f2', question: '¿Dónde veo mis pagos?', answer: 'En Pagos → Historial.', manualSlug: null },
];
const ARTICLES = [
  {
    slug: 'estudiante',
    title: 'Manual del estudiante',
    body: '# Manual del estudiante\nIntro.\n\n## Mi certificado\nAl terminar el curso solicita el certificado desde tu perfil.\n![captura](c.png)\n\n## Foros\nPregunta en el foro de cada lección.',
  },
];

const read = async (s: Readable): Promise<string> => {
  let out = '';
  for await (const c of s) out += String(c);
  return out;
};

describe('Agente Guía sin IA (modo degradado)', () => {
  it('divide el manual por secciones `##` con ancla y sin capturas', () => {
    const s = sections(ARTICLES[0]);
    expect(s.map((x) => x.id)).toEqual(['estudiante', 'estudiante#mi-certificado', 'estudiante#foros']);
    expect(s[1].text).not.toContain('captura');
  });

  it('pregunta parecida a una FAQ → su respuesta aprobada con la cita', () => {
    const r = answerWithoutLlm('olvidé la contraseña, ¿cómo la cambio?', 'es', 'guide', FAQS, ARTICLES);
    expect(r.answeredBy).toBe('faq');
    expect(r.reply).toContain('Seguridad');
    expect(r.sources[0]).toEqual({ kind: 'faq', id: 'f1', title: FAQS[0].question, ref: 'estudiante' });
  });

  it('sin FAQ → la sección del manual más parecida (tildes y plurales tolerados)', () => {
    const r = answerWithoutLlm('¿Dónde pido los certificados?', 'es', 'guide', FAQS, ARTICLES);
    expect(r.answeredBy).toBe('manual');
    expect(r.reply).toContain('solicita el certificado');
    expect(r.sources[0]).toMatchObject({ kind: 'manual', id: 'estudiante#mi-certificado' });
  });

  it('sin coincidencias → «no lo sé» amable (nunca vacío) · soporte remite al botón «Contactar con soporte» (2026-10-28: sin modo tutor)', () => {
    expect(answerWithoutLlm('xyz qwerty', 'en', 'guide', FAQS, ARTICLES)).toMatchObject({ answeredBy: 'none', sources: [] });
    expect(answerWithoutLlm('xyz qwerty', 'es', 'support', FAQS, ARTICLES).reply).toContain('Contactar con soporte');
  });

  const setup = (assistant: object) => {
    const faqs = { find: jest.fn(async () => FAQS) };
    const articles = { find: jest.fn(async () => ARTICLES) };
    return { uc: new AskGuideUseCase(assistant as never, faqs as never, articles as never), faqs };
  };

  it('stream: FastAPI caído (503) → SSE propio (session, tokens, sources con degraded, done) en vez de lanzar', async () => {
    const { uc, faqs } = setup({ guideStream: jest.fn(async () => Promise.reject(new ServiceUnavailableException())) });
    const sse = await read(await uc.stream({ message: '¿Cómo cambio mi contraseña?', locale: 'es' }, 't', new AbortController().signal, Role.USER));
    expect(sse).toMatch(/^event: session\ndata: \{"session_id":"[0-9a-f-]{36}"\}/);
    expect(sse).toContain('event: token');
    expect(sse).toContain('"answered_by":"faq","degraded":true');
    expect(sse.trim().endsWith('event: done\ndata: {}')).toBe(true);
    expect(faqs.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ locale: 'es', status: 'published' }) }));
  });

  it('JSON: FastAPI caído → 200 con `degraded`; otros errores (404) se respetan', async () => {
    const down = setup({ guide: jest.fn(async () => Promise.reject(new ServiceUnavailableException())) });
    await expect(down.uc.execute({ message: 'mis pagos', locale: 'es', sessionId: 's1' }, 't', Role.USER)).resolves.toMatchObject({ session_id: 's1', answered_by: 'faq', degraded: true });
    const missing = setup({ guide: jest.fn(async () => Promise.reject(new NotFoundException())) });
    await expect(missing.uc.execute({ message: 'hola', locale: 'es' }, 't', Role.USER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toSse conserva los saltos de línea de la respuesta', async () => {
    const sse = await read(toSse({ session_id: 's', reply: 'Paso 1\nPaso 2', history: [], answered_by: 'manual', degraded: true }));
    expect(sse).toContain('"text":"1\\n"');
  });
});
