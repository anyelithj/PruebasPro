import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { PolyglotFacade } from '@features/polyglot/application/polyglot.facade';
import { PolyglotRepository } from '@features/polyglot/domain/polyglot.repository.port';
import { PolyglotHttpRepository } from '@features/polyglot/infrastructure/polyglot.http-repository';
import PolyglotPage from '@features/polyglot/presentation/pages/polyglot.page';
import { sessionAs } from '@testing/music-dialogues';
import { pgTable, pgTopic, pgView } from '@testing/polyglot-grammar';
// [Spec PolyglotPage · Sprint 10.7]: tabla con encabezados por idioma (con `lang`), español al final, hueco «Sin término», aviso de revisión nativa sin comparaciones guardadas ni UK/US (2026-11-14); vacío y error | [Herramienta]: render() + msw

const providers = (role: 'USER' | 'TEACHER' = 'USER') => [{ provide: PolyglotRepository, useClass: PolyglotHttpRepository }, PolyglotFacade, sessionAs(role)];

const ok = () =>
  server.use(
    http.get(`${API}/polyglot/topics`, () => HttpResponse.json(envelope([pgTopic()]))),
    http.get(`${API}/polyglot/table`, () => HttpResponse.json(envelope(pgTable()))),
    http.get(`${API}/polyglot/views/me`, () => HttpResponse.json(envelope([pgView]))),
  );

describe('PolyglotPage', () => {
  it('tabla: columnas en el orden por defecto con español al final y celdas accesibles', async () => {
    ok();
    const { el } = await render(PolyglotPage, providers());
    const ths = [...el.querySelectorAll('thead th[lang]')];
    expect(ths.map((th) => th.getAttribute('lang'))).toEqual(['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es']);
    expect(el.querySelector('caption')?.textContent).toContain('Familia');
    expect(el.textContent).toContain('mother');
    expect(el.textContent).toContain('Sin término'); // Portugués vacío
    expect(el.textContent).toContain('Pendiente de revisión por un hablante nativo'); // Ruso y chino
    // [2026-11-14]: sin «Guardar comparación» ni «Mis comparaciones» (se crean en Gestión) y sin interruptor UK/US en la tabla
    expect(el.textContent).not.toContain('Familia ES-EN');
    expect(el.textContent).not.toContain('Guardar esta comparación');
    expect(el.querySelector('aula-accent-switch')).toBeNull();
    // Tema en el MISMO panel de filtros que Gestión (Filtrar · Limpiar)
    expect(el.querySelector('aula-filter-panel aula-polyglot-topic-picker')).not.toBeNull();
    expect(getByRole(el, 'button', 'Limpiar')).toBeTruthy();
    expect(el.querySelector('a[href="/poliglota/administrar"]')).toBeNull(); // Estudiante: sin administrar
  });

  it('docente: acceso a administrar', async () => {
    ok();
    const { el } = await render(PolyglotPage, providers('TEACHER'));
    expect(el.querySelector('a[href="/poliglota/administrar"]')).not.toBeNull();
  });

  it('sin temas → mensaje; error → alerta', async () => {
    server.use(
      http.get(`${API}/polyglot/topics`, () => HttpResponse.json(envelope([]))),
      http.get(`${API}/polyglot/views/me`, () => HttpResponse.json(envelope([]))),
    );
    const { el } = await render(PolyglotPage, providers());
    expect(el.textContent).toContain('Aún no hay temas publicados');
  });

  it('error al cargar los temas → alerta', async () => {
    server.use(
      http.get(`${API}/polyglot/topics`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })),
      http.get(`${API}/polyglot/views/me`, () => HttpResponse.json(envelope([]))),
    );
    const { el } = await render(PolyglotPage, providers());
    expect(getByRole(el, 'alert')).toBeTruthy();
  });

  it('«🔢 Números» aparece dentro de «📚 Vocabulario» (sin select propio)', async () => {
    server.use(
      http.get(`${API}/polyglot/topics`, () =>
        HttpResponse.json(envelope([pgTopic(), { ...pgTopic(), id: 'p2', slug: 'numeros', title: 'Números', category: 'numbers' }])),
      ),
      http.get(`${API}/polyglot/table`, () => HttpResponse.json(envelope(pgTable()))),
    );
    const { el } = await render(PolyglotPage, providers());
    const labels = [...el.querySelectorAll('aula-polyglot-topic-picker label')].map((l) => l.firstChild?.textContent?.trim());
    expect(labels).not.toContain('🔢 Números');
    const vocab = [...el.querySelectorAll('aula-polyglot-topic-picker label')].find((l) => l.textContent?.includes('📚 Vocabulario'))!;
    expect(vocab.textContent).toContain('Números');
  });
});
