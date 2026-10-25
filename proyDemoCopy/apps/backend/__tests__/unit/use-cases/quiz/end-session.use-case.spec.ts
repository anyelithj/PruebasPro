import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EndSessionUseCase } from '../../../../src/modules/quiz/application/use-cases/end-session.use-case';
import { SessionStatus } from '../../../../src/modules/quiz/domain/entities/quiz-session.entity';
import { QUIZ_COMPLETED_EVENT } from '../../../../src/modules/quiz/domain/events/quiz-completed.event';

// [Suite EndSessionUseCase]: cierra sesión, agrega totales y emite QuizCompleted

describe('EndSessionUseCase', () => {
  let useCase: EndSessionUseCase;
  let repo: {
    findSessionById: jest.Mock;
    finalizeSession: jest.Mock;
    findQuizById: jest.Mock;
  };
  let events: { emit: jest.Mock };

  const inProgress = {
    id: 's1',
    userId: 'u1',
    quizId: 'q1',
    status: SessionStatus.IN_PROGRESS,
    answers: [
      { questionId: 'a', isCorrect: true, score: 100 },
      { questionId: 'b', isCorrect: false, score: 0 },
      { questionId: 'c', isCorrect: true, score: 50 },
    ],
  };

  beforeEach(() => {
    repo = {
      findSessionById: jest.fn(),
      finalizeSession: jest.fn(),
      findQuizById: jest.fn(),
    };
    events = { emit: jest.fn() };
    useCase = new EndSessionUseCase(repo as any, events as any);

    repo.findSessionById.mockResolvedValue(inProgress);
    repo.finalizeSession.mockImplementation(async (id, status, total, correct) => ({
      id,
      userId: 'u1',
      quizId: 'q1',
      status,
      totalScore: total,
      correctCount: correct,
    }));
    repo.findQuizById.mockResolvedValue({ questions: [{}, {}, {}] });
  });

  it('completa la sesión: agrega score/aciertos y emite evento', async () => {
    const res = await useCase.execute('s1', 'u1');

    expect(repo.finalizeSession).toHaveBeenCalledWith(
      's1',
      SessionStatus.COMPLETED,
      150, // 100 + 0 + 50
      2, // dos correctas
    );
    expect(events.emit).toHaveBeenCalledWith(
      QUIZ_COMPLETED_EVENT,
      expect.objectContaining({
        sessionId: 's1',
        totalScore: 150,
        correctCount: 2,
        totalQuestions: 3,
      }),
    );
    expect(res.status).toBe(SessionStatus.COMPLETED);
  });

  it('abandono: finaliza como ABANDONED y NO emite evento', async () => {
    await useCase.execute('s1', 'u1', true);
    expect(repo.finalizeSession).toHaveBeenCalledWith(
      's1',
      SessionStatus.ABANDONED,
      150,
      2,
    );
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('lanza NotFound si la sesión no existe', async () => {
    repo.findSessionById.mockResolvedValue(null);
    await expect(useCase.execute('sX', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('lanza Forbidden si la sesión no pertenece al usuario', async () => {
    await expect(useCase.execute('s1', 'otro')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('retorna la sesión sin cambios si no está en progreso (idempotencia)', async () => {
    const done = { ...inProgress, status: SessionStatus.COMPLETED };
    repo.findSessionById.mockResolvedValue(done);
    const res = await useCase.execute('s1', 'u1');
    expect(res).toBe(done);
    expect(repo.finalizeSession).not.toHaveBeenCalled();
  });

  it('usa 0 preguntas si el quiz ya no existe', async () => {
    repo.findQuizById.mockResolvedValue(null);
    await useCase.execute('s1', 'u1');
    expect(events.emit).toHaveBeenCalledWith(
      QUIZ_COMPLETED_EVENT,
      expect.objectContaining({ totalQuestions: 0 }),
    );
  });
});
