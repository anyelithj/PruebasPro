import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { PracticeHttpRepository } from '@features/practice/infrastructure/practice.http-repository';
// [Spec PracticeHttpRepository · Sprints 8.14/8.15]: actividad del estudiante (ítems sin respuestas), intento con hallazgos, filtros + «mine» y 403 al crear como estudiante | [Herramienta]: msw 2

const activity = { id: 'a1', title: 'Presente simple', description: '', language: 'en', level: 'A2', skill: 'grammar', status: 'published', aiDraft: false, createdBy: 't1', archivedAt: null, createdAt: '', updatedAt: '', items: [{ id: 'i1', position: 0, itemType: 'mark_errors', skill: 'grammar', prompt: 'She go to school', options: [], blanks: undefined }] };
const attempt = { id: 'at1', userId: 'u1', activityId: 'a1', itemId: 'i1', answer: ['1'], correct: true, score: '1.00', createdAt: '', feedback: { correct: true, score: 1, findings: [{ type: 'grammar', original: 'go', correction: 'goes', explanation_es: 'Tercera persona', start: 4, end: 6 }], correct_answer: 'She goes to school', explanation: '', tip: 'Recuerda la -s', method: 'deterministic' } };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), PracticeHttpRepository] });
  return TestBed.inject(PracticeHttpRepository);
}

describe('PracticeHttpRepository', () => {
  it('actividad con ítems de estudiante e intento con hallazgos (score decimal → número)', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/practice/activities/a1`, () => HttpResponse.json(envelope(activity))),
      http.post(`${API}/practice/attempts`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(attempt), { status: 201 });
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.activity('a1'))).items[0].itemType).toBe('mark_errors');
    const a = await firstValueFrom(repo.submit('i1', ['1']));
    expect(body).toEqual({ itemId: 'i1', answer: ['1'] });
    expect(a.score).toBe(1);
    expect(a.feedback.findings[0].correction).toBe('goes');
  });

  it('filtros con valor + mine=true viajan en la query', async () => {
    let url = '';
    server.use(
      http.get(`${API}/practice/activities`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([]));
      }),
    );
    await firstValueFrom(setup().activities({ language: 'en', level: '', mine: true }));
    expect(new URL(url).searchParams.toString()).toBe('language=en&mine=true');
  });

  it('estudiante creando actividad → 403 como ApiError', async () => {
    server.use(http.post(`${API}/practice/activities`, () => HttpResponse.json({ message: 'Forbidden resource' }, { status: 403 })));
    await expect(firstValueFrom(setup().createActivity({ title: 'x y z', description: '', language: 'en', level: 'A1', skill: 'grammar' }))).rejects.toEqual(new ApiError(403, 'Forbidden resource'));
  });
});
