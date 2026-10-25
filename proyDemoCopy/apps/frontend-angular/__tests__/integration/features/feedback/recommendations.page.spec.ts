import { of } from 'rxjs';
import { render } from '@testing/render';
import { FeedbackFacade } from '@features/feedback/application/feedback.facade';
import { FeedbackRepository } from '@features/feedback/domain/feedback.repository.port';
import type { StudyPlanView } from '@features/feedback/domain/models/feedback';
import RecommendationsPage from '@features/feedback/presentation/pages/recommendations.page';
// [Spec RecommendationsPage]: contenedor — debilidades con recomendación, fortalezas y progreso ordenado (lo más débil primero) | [Patrón]: Test Double del puerto

const history = [
  { quizCategory: 'reading', status: 'completed', correctCount: 9, totalQuestions: 10 },
  { quizCategory: 'grammar', status: 'completed', correctCount: 2, totalQuestions: 10 },
];
const view: StudyPlanView = { weaknesses: { weak_topics: [{ topic: 'grammar', accuracy: 0.2, recommendation: 'Repasa los tiempos verbales' }], strong_topics: ['reading'] }, plan: null };

describe('RecommendationsPage', () => {
  it('lista debilidades, fortalezas y barras de progreso accesibles', async () => {
    const { el } = await render(RecommendationsPage, [FeedbackFacade, { provide: FeedbackRepository, useValue: { history: () => of(history), studyPlan: () => of(view) } }]);
    expect(el.textContent).toContain('Repasa los tiempos verbales');
    expect(el.textContent).toContain('Acierto 20 %');
    expect(el.textContent).toContain('reading');
    const bars = [...el.querySelectorAll('progress')];
    expect(bars.map((b) => b.getAttribute('value'))).toEqual(['20', '90']);
    expect(el.querySelector(`label[for="${bars[0]!.id}"]`)?.textContent).toContain('grammar');
  });
});
