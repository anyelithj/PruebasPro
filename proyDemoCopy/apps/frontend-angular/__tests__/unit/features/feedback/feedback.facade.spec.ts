import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeedbackRepository } from '@features/feedback/domain/feedback.repository.port';
import { accuracyByTopic, type HistoryItem, type StudyPlanView } from '@features/feedback/domain/models/feedback';
import { FeedbackFacade } from '@features/feedback/application/feedback.facade';
// [Spec FeedbackFacade]: precisión por tema (solo completados), una sola carga para las dos pantallas, sin datos → no llama a la IA | [Patrón]: Test Double (repositorio falso)

const h = (quizCategory: string, correctCount: number, totalQuestions: number, status = 'completed'): HistoryItem => ({ quizCategory, status, correctCount, totalQuestions });
const view: StudyPlanView = { weaknesses: { weak_topics: [{ topic: 'grammar', accuracy: 0.4, recommendation: 'Repasa' }], strong_topics: ['listening'] }, plan: { plan: [], total_minutes: 0 } };

function setup(history: HistoryItem[]) {
  const studyPlan = jest.fn(() => of(view));
  const historyFn = jest.fn(() => of(history));
  TestBed.configureTestingModule({ providers: [FeedbackFacade, { provide: FeedbackRepository, useValue: { history: historyFn, studyPlan } }] });
  return { facade: TestBed.inject(FeedbackFacade), studyPlan, historyFn };
}

describe('FeedbackFacade', () => {
  it('accuracyByTopic suma por tema e ignora exámenes no completados', () => {
    expect(accuracyByTopic([h('grammar', 2, 4), h('grammar', 1, 4), h('reading', 5, 5, 'abandoned')])).toEqual({ grammar: 3 / 8 });
  });

  it('carga una vez (memo) y pide el plan con la precisión calculada', async () => {
    const { facade, studyPlan, historyFn } = setup([h('grammar', 2, 5)]);
    await facade.load();
    await facade.load();
    expect(historyFn).toHaveBeenCalledTimes(1);
    expect(studyPlan).toHaveBeenCalledWith({ grammar: 0.4 }, 0.6);
    expect(facade.plan.data()).toEqual(view);
  });

  it('sin exámenes completados no llama a la IA', async () => {
    const { facade, studyPlan } = setup([]);
    await facade.load();
    expect(facade.noData()).toBe(true);
    expect(studyPlan).not.toHaveBeenCalled();
  });
});
