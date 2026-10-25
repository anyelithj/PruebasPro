import { of, throwError } from 'rxjs';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { FeedbackFacade } from '@features/feedback/application/feedback.facade';
import { FeedbackRepository } from '@features/feedback/domain/feedback.repository.port';
import type { StudyPlanView } from '@features/feedback/domain/models/feedback';
import StudyPlanPage from '@features/feedback/presentation/pages/study-plan.page';
// [Spec StudyPlanPage]: contenedor — plan ordenado, sin datos, IA no disponible y error | [Patrón]: Test Double del puerto

const history = [{ quizCategory: 'grammar', status: 'completed', correctCount: 1, totalQuestions: 4 }];
const view: StudyPlanView = {
  weaknesses: { weak_topics: [], strong_topics: [] },
  plan: { plan: [{ order: 1, topic: 'grammar', activity: 'Ejercicios de tiempos verbales', estimated_minutes: 20 }], total_minutes: 20 },
};
const providers = (repo: Partial<FeedbackRepository>) => [FeedbackFacade, { provide: FeedbackRepository, useValue: { history: () => of(history), studyPlan: () => of(view), ...repo } }];

describe('StudyPlanPage', () => {
  it('muestra los pasos en una lista ordenada y el total', async () => {
    const { el } = await render(StudyPlanPage, providers({}));
    expect(el.querySelector('ol li')?.textContent).toContain('Ejercicios de tiempos verbales');
    expect(el.textContent).toContain('Tiempo total: 20 min');
  });

  it('sin exámenes → mensaje para empezar', async () => {
    const { el } = await render(StudyPlanPage, providers({ history: () => of([]) }));
    expect(el.textContent).toContain('Resuelve al menos un examen');
  });

  it('IA no disponible (null) → aviso sin romper la página', async () => {
    const { el } = await render(StudyPlanPage, providers({ studyPlan: () => of(null) }));
    expect(getByRole(el, 'status').textContent).toContain('no está disponible');
  });

  it('error → alerta con Reintentar', async () => {
    const { el } = await render(StudyPlanPage, providers({ history: () => throwError(() => new Error('Sin conexión')) }));
    expect(getByRole(el, 'alert').textContent).toContain('Sin conexión');
  });
});
