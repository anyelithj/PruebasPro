import { Quiz } from '../entities/quiz.entity';
import { Question } from '../entities/question.entity';
import {
  QuizSession,
  SessionAnswer,
  SessionStatus,
} from '../entities/quiz-session.entity';
import { Category } from '../value-objects/category.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import { Language } from '../value-objects/language.vo';
// [Port repositorio Quiz/Session]: contrato Domain → Infrastructure | [Patrón]: Repository + Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const QUIZ_REPOSITORY = Symbol('QUIZ_REPOSITORY');

// [Input crear quiz]: subset mínimo para persistir
export interface CreateQuizInput {
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  // [Idioma]: aplica a Quiz y propaga default a cada Question si no trae override | [Principio]: DRY
  language?: Language;
  authorId: string;
  source?: string;
  timePerQuestionSeconds?: number;
  isPublished?: boolean;
  questions: Omit<Question, 'id' | 'quiz' | 'quizId'>[];
}

// [Opciones de listado]: paginación + filtros opcionales | [Principio]: ISP
export interface ListQuizzesOptions {
  page?: number;
  limit?: number;
  category?: Category;
  difficulty?: Difficulty;
  authorId?: string;
  publishedOnly?: boolean;
}

export interface PaginatedQuizzes {
  data: Quiz[];
  total: number;
  page: number;
  limit: number;
}

export interface IQuizRepository {
  // ===== Quiz =====
  createQuiz(input: CreateQuizInput): Promise<Quiz>;
  findQuizById(id: string, withQuestions?: boolean): Promise<Quiz | null>;
  listQuizzes(options: ListQuizzesOptions): Promise<PaginatedQuizzes>;
  updateQuiz(id: string, partial: Partial<Quiz>): Promise<Quiz>;
  deleteQuiz(id: string): Promise<void>;
  // [Reemplazo total de preguntas]: borra todas e inserta nuevo set | [Patrón]: Full Replace
  replaceQuestions(
    quizId: string,
    questions: Omit<Question, 'id' | 'quiz' | 'quizId'>[],
  ): Promise<Quiz>;

  // ===== QuizSession =====
  createSession(userId: string, quizId: string): Promise<QuizSession>;
  findSessionById(id: string): Promise<QuizSession | null>;
  appendSessionAnswer(
    sessionId: string,
    answer: SessionAnswer,
  ): Promise<QuizSession>;
  finalizeSession(
    sessionId: string,
    status: SessionStatus,
    totalScore: number,
    correctCount: number,
  ): Promise<QuizSession>;
  listSessionsByUser(userId: string, limit?: number): Promise<QuizSession[]>;
}
