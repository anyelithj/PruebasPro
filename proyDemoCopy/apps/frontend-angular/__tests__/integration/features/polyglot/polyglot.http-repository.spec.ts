import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { PolyglotHttpRepository } from '@features/polyglot/infrastructure/polyglot.http-repository';
import { pgTable, pgView, term } from '@testing/polyglot-grammar';
// [Spec PolyglotHttpRepository · Sprints 10.7/10.8]: tabla con ?topic=&languages= en orden, términos por POST, vistas guardadas, y no envía URL ni licencia vacías al crear un concepto | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), PolyglotHttpRepository] });
  return TestBed.inject(PolyglotHttpRepository);
}

describe('PolyglotHttpRepository', () => {
  it('pide la tabla con los idiomas en el orden elegido y la valida', async () => {
    let url = '';
    server.use(
      http.get(`${API}/polyglot/table`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope(pgTable(['es', 'en'])));
      }),
    );
    const t = await firstValueFrom(setup().table('p1', ['es', 'en']));
    expect(new URL(url).searchParams.get('languages')).toBe('es,en');
    expect(t.rows[0].terms['en']?.text).toBe('mother');
  });

  it('concepto sin imagen: no envía campos vacíos; términos por POST', async () => {
    let conceptBody: unknown;
    let termsBody: unknown;
    server.use(
      http.post(`${API}/polyglot/topics/p1/concepts`, async ({ request }) => {
        conceptBody = await request.json();
        return HttpResponse.json(envelope({ id: 'c9', topicId: 'p1', position: 1, kind: 'word', emoji: '🐕', imageUrl: null, imageLicense: null, gloss: 'perro' }));
      }),
      http.post(`${API}/polyglot/concepts/c9/terms`, async ({ request }) => {
        termsBody = await request.json();
        return HttpResponse.json(envelope([term('en', 'dog')]));
      }),
    );
    const repo = setup();
    await firstValueFrom(repo.addConcept('p1', { kind: 'word', emoji: '🐕', gloss: 'perro', imageUrl: '', imageLicense: '' }));
    expect(conceptBody).toEqual({ kind: 'word', emoji: '🐕', gloss: 'perro' });
    await firstValueFrom(repo.upsertTerms('c9', [{ language: 'en', text: 'dog' }]));
    expect(termsBody).toEqual({ terms: [{ language: 'en', text: 'dog' }] });
  });

  it('vistas guardadas: /views/me, POST y DELETE', async () => {
    let deleted = false;
    server.use(
      http.get(`${API}/polyglot/views/me`, () => HttpResponse.json(envelope([pgView]))),
      http.post(`${API}/polyglot/views`, () => HttpResponse.json(envelope(pgView))),
      http.delete(`${API}/polyglot/views/v1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.listViews()))[0].name).toBe('Familia ES-EN');
    expect((await firstValueFrom(repo.saveView({ topicId: 'p1', languages: ['es', 'en'] }))).id).toBe('v1');
    await firstValueFrom(repo.deleteView('v1'));
    expect(deleted).toBe(true);
  });
});
