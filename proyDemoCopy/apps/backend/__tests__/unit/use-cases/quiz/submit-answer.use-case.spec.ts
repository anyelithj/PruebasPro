import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SubmitAnswerUseCase } from '../../../../src/modules/quiz/application/use-cases/submit-answer.use-case';
import { SessionStatus } from '../../../../src/modules/quiz/domain/entities/quiz-session.entity';
import { QuestionType } from '../../../../src/modules/quiz/domain/entities/question.entity';
import { Difficulty } from '../../../../src/modules/quiz/domain/value-objects/difficulty.vo';

// [Suite SubmitAnswerUseCase]: scoring local/IA, idempotencia, feedback y validaciones

describe('SubmitAnswerUseCase', () => {
  let useCase: SubmitAnswerUseCase;
  let repo: {
    findSessionById: jest.Mock;
    findQuizById: jest.Mock;
    appendSessionAnswer: jest.Mock;
  };
  let ai: { grade: jest.Mock; generateFeedback: jest.Mock };

  const mcQuestion = {
    id: 'qq1',
    type: QuestionType.MULTIPLE_CHOICE,
    text: '2+2?',
    correctAnswer: '4',
    difficulty: Difficulty.EASY,
    timeLimitSeconds: 10,
    feedback: undefined,
  };

  const openQuestion = {
    id: 'qq2',
    type: QuestionType.OPEN_ANSWER,
    text: 'Explica X',
    correctAnswer: 'respuesta modelo',
    difficulty: Difficulty.HARD,
    language: 'es',
    feedback: undefined,
  };

  const baseSession = {
    id: 's1',
    userId: 'u1',
    quizId: 'q1',
    status: SessionStatus.IN_PROGRESS,
    answers: [],
  };

  const quiz = {
    id: 'q1',
    category: 'math',
    language: 'es',
    timePerQuestionSeconds: 20,
    questions: [mcQuestion, openQuestion],
  };

  beforeEach(() => {
    repo = {
      findSessionById: jest.fn().mockResolvedValue(baseSession),
      findQuizById: jest.fn().mockResolvedValue(quiz),
      appendSessionAnswer: jest.fn().mockImplementation(async (_id, ans) => ({
        id: 's1',
        answers: [ans],
      })),
    };
    ai = { grade: jest.fn(), generateFeedback: jest.fn() };
    const saveFeedback = { execute: jest.fn().mockResolvedValue({ id: 'fb1' }) };
    useCase = new SubmitAnswerUseCase(repo as any, ai as any, saveFeedback as any);
  });

  it('MC correcta: scoring local exacto sin llamar IA, score = base * mult + bonus', async () => {
    // [limit=10000, time=2000]: bonus = round((8000/10000)*50) = 40
    const res = await useCase.execute(
      's1',
      'u1',
      { questionId: 'qq1', userAnswer: ' 4 ', timeTakenMs: 2000 },
      'token',
    );

    expect(ai.grade).not.toHaveBeenCalled();
    expect(res.isCorrect).toBe(true);
    expect(res.strategy).toBe('exact_match_local');
    // EASY mult=1.0 → 100*1 + 40 bonus
    expect(res.score).toBe(140);
    expect(res.feedback).toBeNull();
  });

  it('sin tiempo de respuesta (timeTakenMs ausente): bonus de velocidad = 0', async () => {
    const res = await useCase.execute(
      's1',
      'u1',
      { questionId: 'qq1', userAnswer: '4' },
      'token',
    );
    // EASY mult=1.0, sin bonus
    expect(res.score).toBe(100);
  });

  it('MC incorrecta: score 0 y genera feedback IA cuando no hay feedback almacenado', async () => {
    ai.generateFeedback.mockResolvedValue({ message: 'revisa la suma' });
    const res = await useCase.execute(
      's1',
      'u1',
      { questionId: 'qq1', userAnswer: '5', timeTakenMs: 5000 },
      'token',
    );
    expect(res.isCorrect).toBe(false);
    expect(res.score).toBe(0);
    expect(ai.generateFeedback).toHaveBeenCalled();
    expect(res.feedback).toBe('revisa la suma');
  });

  it('MC incorrecta: prefiere feedback almacenado en la pregunta sobre IA', async () => {
    repo.findQuizById.mockResolvedValue({
      ...quiz,
      questions: [{ ...mcQuestion, feedback: 'feedback del autor' }, openQuestion],
    });
    const res = await useCase.execute(
      's1',
      'u1',
      { questionId: 'qq1', userAnswer: '5' },
      'token',
    );
    expect(res.feedback).toBe('feedback del autor');
    expect(ai.generateFeedback).not.toHaveBeenCalled();
  });

  it('OPEN_ANSWER: usa IA para calificar y propaga estrategia', async () => {
    ai.grade.mockResolvedValue({ is_correct: true, strategy_used: 'semantic_ai' });
    const res = await useCase.execute(
      's1',
      'u1',
      { questionId: 'qq2', userAnswer: 'mi respuesta', timeTakenMs: 2000 },
      'token',
    );
    expect(ai.grade).toHaveBeenCalled();
    expect(res.strategy).toBe('semantic_ai');
    // HARD mult=2.0 → 100*2 + 45 bonus (limit=20s, time=2s → round(18/20*50))
    expect(res.score).toBe(245);
  });

  it('lanza BadRequest si la sesión no existe', async () => {
    repo.findSessionById.mockResolvedValue(null);
    await expect(
      useCase.execute('sX', 'u1', { questionId: 'qq1', userAnswer: '4' }, 't'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza Forbidden si la sesión es de otro usuario', async () => {
    await expect(
      useCase.execute('s1', 'otro', { questionId: 'qq1', userAnswer: '4' }, 't'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanza BadRequest si la sesión no está en progreso', async () => {
    repo.findSessionById.mockResolvedValue({
      ...baseSession,
      status: SessionStatus.COMPLETED,
    });
    await expect(
      useCase.execute('s1', 'u1', { questionId: 'qq1', userAnswer: '4' }, 't'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequest si el quiz ya no existe', async () => {
    repo.findQuizById.mockResolvedValue(null);
    await expect(
      useCase.execute('s1', 'u1', { questionId: 'qq1', userAnswer: '4' }, 't'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequest si la pregunta no pertenece al quiz', async () => {
    await expect(
      useCase.execute('s1', 'u1', { questionId: 'noexiste', userAnswer: '4' }, 't'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequest si la pregunta ya fue respondida (idempotencia)', async () => {
    repo.findSessionById.mockResolvedValue({
      ...baseSession,
      answers: [{ questionId: 'qq1' }],
    });
    await expect(
      useCase.execute('s1', 'u1', { questionId: 'qq1', userAnswer: '4' }, 't'),
    ).rejects.toThrow(BadRequestException);
  });
});
