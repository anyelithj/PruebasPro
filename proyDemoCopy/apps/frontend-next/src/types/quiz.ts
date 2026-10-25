// [Tipos compartidos Quiz]: SSOT entre frontend y backend | [Patron]: Type Module | [Principio]: SSOT | [Paradigma]: TS estructural

export type Difficulty = "easy" | "medium" | "hard";

// [Competencias lingüísticas]: alineadas con ACTIVE_CATEGORIES del backend
export type LanguageSkill =
  | "general"
  | "grammar"
  | "vocabulary"
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "pronunciation"
  | "custom";

// [Legacy]: materias escolares de la versión anterior; pueden llegar en quizzes antiguos desde la API
export type LegacyCategory =
  | "language"
  | "math"
  | "science"
  | "biology"
  | "physics"
  | "chemistry"
  | "history"
  | "geography"
  | "social_sciences"
  | "english"
  | "technology"
  | "art";

export type Category = LanguageSkill | LegacyCategory;

export type QuestionType = "multiple_choice" | "true_false" | "open_answer";

// [Idioma objetivo ISO 639-1]: alineado con Language VO del backend
export type Language = "en" | "es" | "fr" | "de" | "pt" | "zh" | "ru";

// [Motores LLM locales]: alineado con AIProvider del backend (Aya por defecto)
export type AIProvider = "aya" | "qwen" | "mistral";

export type SessionStatus = "in_progress" | "completed" | "abandoned";

export interface QuestionPublic {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  difficulty: Difficulty;
  position: number;
  timeLimitSeconds?: number;
  explanation?: string;
  feedback?: string;
}

export interface QuestionWithAnswer extends QuestionPublic {
  correctAnswer: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  // [Idioma objetivo]: presente en la entidad devuelta por GET /quiz/:id
  language?: Language;
  authorId: string;
  source: string;
  timePerQuestionSeconds: number;
  isPublished: boolean;
  createdAt: string;
  questions?: QuestionPublic[];
}

export interface QuizListItem {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  questionsCount: number;
  timePerQuestionSeconds: number;
  // [Estado publicación]: requerido para panel docente (toggle publicar/despublicar) | [Principio]: ISP
  isPublished: boolean;
}

export interface PaginatedQuizzes {
  data: QuizListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  timeTakenMs: number;
  answeredAt: string;
}

// [Feedback IA por respuesta]: lo emite SubmitAnswerUseCase, no se persiste en BD | [Principio]: SSOT
export interface AnswerFeedback {
  questionId: string;
  feedback: string | null;
  strategy: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  quizId: string;
  status: SessionStatus;
  answers: SessionAnswer[];
  totalScore: number;
  correctCount: number;
  startedAt: string;
  completedAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  // [Nombre legible]: provisto por backend (join users); fallback 'Usuario xxxx' si nulo | [Principio]: SSOT
  displayName: string;
  totalPoints: number;
  quizzesCompleted: number;
  avgAccuracy: number;
}

export interface SubmitAnswerInput {
  questionId: string;
  userAnswer: string;
  timeTakenMs?: number;
}

// [Input creación quiz]: SSOT entre form RHF/Zod y backend NestJS CreateQuizDto | [Principio]: SSOT
export interface CreateQuizQuestionInput {
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  language?: Language;
  timeLimitSeconds?: number;
  explanation?: string;
  feedback?: string;
}

export interface CreateQuizInput {
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  language?: Language;
  timePerQuestionSeconds?: number;
  isPublished?: boolean;
  questions: CreateQuizQuestionInput[];
}

// [Historial académico]: SSOT con ListMyHistoryUseCase backend | [Principio]: SSOT
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

export interface ScoreEntry {
  id: string;
  userId: string;
  quizId: string;
  sessionId: string;
  points: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  createdAt: string;
}
