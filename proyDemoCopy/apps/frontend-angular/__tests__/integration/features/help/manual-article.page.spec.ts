import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { HELP_PROVIDERS } from '@features/help/help.routes';
import ManualArticlePage from '@features/help/presentation/pages/manual-article.page';
// [Spec ManualArticlePage]: Markdown → HTML con anclas en los `##`, un solo <h1>, HTML peligroso eliminado (DOMPurify) y 404 | [Herramienta]: render() + setInput (slug de la ruta)

const BODY = '# Manual del estudiante\n\nIntro.\n\n## Cómo pagar\n1. Abre el carrito.\n2. Paga.\n\n<img src=x onerror="alert(1)"><script>alert(2)</script>\n\n## Mis certificados\nTexto.';

async function open(slug: string) {
  const r = await render(ManualArticlePage, HELP_PROVIDERS);
  r.fixture.componentRef.setInput('slug', slug);
  await settle(r.fixture);
  return r;
}

describe('ManualArticlePage', () => {
  it('pinta el artículo saneado con anclas e índice', async () => {
    server.use(http.get(`${API}/help/manual/estudiante`, () => HttpResponse.json(envelope({ slug: 'estudiante', title: 'Manual del estudiante', role: 'USER', locale: 'es', body: BODY, updatedAt: '' }))));
    const { el } = await open('estudiante');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('article h2#como-pagar')?.textContent).toBe('Cómo pagar');
    expect(el.querySelectorAll('article ol li')).toHaveLength(2);
    expect(el.querySelector('article script')).toBeNull();
    expect(el.querySelector('article img')?.getAttribute('onerror')).toBeNull();
    expect(el.querySelector('nav a[href$="#mis-certificados"]')).not.toBeNull();
  });

  it('404 → alerta y enlace al manual', async () => {
    server.use(http.get(`${API}/help/manual/nada`, () => HttpResponse.json({ message: 'Artículo del manual no encontrado' }, { status: 404 })));
    const { el } = await open('nada');
    expect(getByRole(el, 'alert').textContent).toContain('no encontrado');
  });
});
