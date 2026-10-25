import { Inject, Injectable } from '@nestjs/common';
import {
  QUIZ_REPOSITORY,
  type IQuizRepository,
} from '../../domain/interfaces/quiz.repository.interface';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
import {
  SessionAnswer,
  SessionStatus,
} from '../../domain/entities/quiz-session.entity';
import { QuestionType } from '../../domain/entities/question.entity';
// [Use Case ListMyHistory]: lectura del avance académico del estudiante (sesiones + score + feedback por pregunta) | [Patrón]: Query + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO

// [Forma respuesta]: enriquecida con info del quiz + por-pregunta feedback para seguimiento docente | [Principio]: ISP
export interface MyHistoryAnswerView {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  options?: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
  timeTakenMs: number;
  answeredAt: string;
  // [Feedback pedagógico]: viene del Question.feedback (generado por IA / autor) | [Principio]: SRP
  feedback?: string;
  explanation?: string;
}

export interface MyHistoryItem {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  quizCategory: Category;
  quizDifficulty: Difficulty;
  status: SessionStatus;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  startedAt: string;
  completedAt?: string;
  answers: MyHistoryAnswerView[];
}

@Injectable()
export class ListMyHistoryUseCase {
  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
  ) {}

  // [execute]: lee sesiones del user → enriquece con quiz + question text/feedback | [Patrón]: Query Composer | [Principio]: SRP
  async execute(userId: string, limit = 20): Promise<MyHistoryItem[]> {
    const sessions = await this.repo.listSessionsByUser(userId, limit);
    const items: MyHistoryItem[] = [];
    for (const s of sessions) {
      // [Carga quiz con preguntas]: necesario para texto + feedback | [Principio]: DRY
      const quiz = await this.repo.findQuizById(s.quizId, true);
      if (!quiz) continue;
      const questionsById = new Map(
        (quiz.questions ?? []).map((q) => [q.id, q] as const),
      );
      const totalQuestions = quiz.questions?.length ?? s.answers.length;
      const answers: MyHistoryAnswerView[] = s.answers.map(
        (a: SessionAnswer): MyHistoryAnswerView => {
          const q = questionsById.get(a.questionId);
          return {
            questionId: a.questionId,
            questionText: q?.text ?? '(pregunta eliminada)',
            questionType: q?.type ?? QuestionType.MULTIPLE_CHOICE,
            options: q?.options,
            userAnswer: a.userAnswer,
            correctAnswer: q?.correctAnswer ?? '',
            isCorrect: a.isCorrect,
            score: a.score,
            timeTakenMs: a.timeTakenMs,
            answeredAt: a.answeredAt,
            feedback: q?.feedback,
            explanation: q?.explanation,
          };
        },
      );
      items.push({
        sessionId: s.id,
        quizId: s.quizId,
        quizTitle: quiz.title,
        quizCategory: quiz.category,
        quizDifficulty: quiz.difficulty,
        status: s.status,
        totalScore: s.totalScore,
        correctCount: s.correctCount,
        totalQuestions,
        accuracy: totalQuestions > 0 ? s.correctCount / totalQuestions : 0,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
        answers,
      });
    }
    return items;
  }
}
