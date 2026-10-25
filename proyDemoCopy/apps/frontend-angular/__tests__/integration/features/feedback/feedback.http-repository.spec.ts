import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { FeedbackHttpRepository } from '@features/feedback/infrastructure/feedback.http-repository';
// [Spec FeedbackHttpRepository]: historial (respuesta sin envelope del BFF estático), plan con envelope y `null` cuando la IA no está | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), FeedbackHttpRepository] });
  return TestBed.inject(FeedbackHttpRepository);
}

describe('FeedbackHttpRepository', () => {
  it('historial con limit=50 y solo los campos del modelo', async () => {
    let limit: string | null = null;
    server.use(
      http.get(`${API}/quiz/sessions/me`, ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit');
        return HttpResponse.json([{ quizCategory: 'grammar', status: 'completed', correctCount: 3, totalQuestions: 5, quizTitle: 'extra' }]);
      }),
    );
    expect(await firstValueFrom(setup().history())).toEqual([{ quizCategory: 'grammar', status: 'completed', correctCount: 3, totalQuestions: 5 }]);
    expect(limit).toBe('50');
  });

  it('plan de estudio: envelope desenvuelto y null si la IA no responde', async () => {
    const plan = { weaknesses: { weak_topics: [], strong_topics: [] }, plan: null };
    server.use(http.post(`${API}/ai/feedback/study-plan`, () => HttpResponse.json(envelope(plan))));
    const repo = setup();
    expect(await firstValueFrom(repo.studyPlan({ grammar: 0.4 }, 0.6))).toEqual(plan);
    server.use(http.post(`${API}/ai/feedback/study-plan`, () => HttpResponse.json(envelope(null))));
    expect(await firstValueFrom(repo.studyPlan({ grammar: 0.4 }, 0.6))).toBeNull();
  });
});
