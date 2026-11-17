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
  // [2026-11-06 · Exámenes]: practice = quiz libre · final = examen final de curso · level = examen de nivel
  kind?: QuizKind;
  courseId?: string | null;
  cefrLevel?: string | null;
  passScore?: number;
  timeLimitMinutes?: number; // Tiempo TOTAL (0 = sin límite)
  questionsPerAttempt?: number;
}

export type QuizKind = "practice" | "final" | "level";
export const isExamKind = (k?: string | null): boolean => k === "final" || k === "level";

// [ExamCatalogItem · 2026-11-06]: GET /quiz/exams/catalog — exámenes finales y de nivel con candado para el usuario
export interface ExamCatalogItem {
  quizId: string | null; // null = examen final aún sin generar
  kind: "final" | "level";
  title: string;
  cefrLevel: string | null;
  language: string;
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
  questions: number;
  timeLimitMinutes: number;
  passScore: number;
  progress: number | null;
  enrolled: boolean;
  locked: boolean;
  passed: boolean;
}

// [ExamManageRow · 2026-11-06]: GET /quiz/exams/manage — Gestión → Certificados
export interface ExamManageRow {
  courseId: string;
  courseTitle: string;
  cefrLevel: string | null;
  language: string | null;
  published: boolean;
  quizId: string | null;
  questions: number;
  passed: number;
  state: "ready" | "generating" | "error" | "missing";
  message: string | null;
}

// [IssuedCertificate · 2026-11-06]: GET /certificates/issued
export interface IssuedCertificate {
  id: string;
  code: string;
  recipientName: string;
  courseTitle: string;
  cefrLevel: string | null;
  examScore: number | null;
  status: "issued" | "revoked";
  revokeReason: string | null;
  issuedAt: string;
  courseId: string | null;
  anchorTxHash?: string | null; // [2026-11-09]: null = pendiente de anclaje en Sepolia
  revokeRequestReason?: string | null; // Revocación pedida por el docente
  teacherName?: string | null;
}

// [CertificateDetail · 2026-11-09 · RF-32]: GET /certificates/:id/detail
export interface CertificateDetail {
  id: string;
  code: string;
  status: "valid" | "revoked" | "pending";
  recipientName: string;
  studentEmail: string | null; // Solo ADMIN
  courseId: string | null;
  courseTitle: string;
  currentCourseTitle: string | null;
  cefrLevel: string | null;
  examScore: number | null;
  quizId: string | null;
  progress: number | null;
  teacherName: string | null;
  pdfSha256: string;
  sizeBytes: number;
  anchorTxHash: string | null;
  explorerUrl: string | null;
  issuedAt: string;
  revokeReason: string | null;
  revokedAt: string | null;
  revokeRequestReason: string | null;
  revokeRequestedAt: string | null;
  adminNotes: string | null; // Solo ADMIN
}

// [2026-11-09 · RF-32]: GET /quiz/exams/attempts — alumno × examen
export interface ExamAttemptRow {
  userId: string;
  studentName: string;
  studentEmail: string | null;
  quizId: string;
  kind: "final" | "level";
  examTitle: string;
  courseId: string | null;
  courseTitle: string | null;
  progress: number | null;
  attemptsUsed: number;
  voided: number;
  bestPercent: number | null;
  passed: boolean;
  inProgress: boolean;
  lastAttemptAt: string | null;
  retryAt: string | null;
  certificateCode: string | null;
  closureApprovedAt: string | null; // [2026-11-09 · RF-32]: cierre académico validado por el docente
  finalGrade: number | null; // Nota corregida por el docente (null = la del examen)
  gradeNote: string | null;
}

export interface CertificateTemplate {
  institution: string;
  signerName: string | null;
  signerTitle: string | null;
  legalText: string | null;
  updatedAt: string | null;
}

export interface IssuedFilters {
  search?: string;
  status?: string;
  courseId?: string;
  from?: string;
  to?: string;
}

// [ExamStatus · 2026-11-06]: GET /quiz/exams/course/:id y /quiz/exams/level
export interface ExamStatus {
  state: "locked" | "generating" | "error" | "ready" | "wait" | "passed";
  quizId: string | null;
  title: string;
  cefrLevel: string | null;
  passScore: number;
  timeLimitMinutes: number;
  questions: number;
  attemptsUsed: number;
  attemptsLeft: number;
  retryAt: string | null;
  bestPercent: number | null;
  inProgress: boolean;
  progress?: number;
  message?: string;
}

export interface QuizListItem {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  questionsCount: number;
  timePerQuestionSeconds: number;
  language?: Language; // [2026-10-27]: GET /quiz ya devuelve la columna (entidad completa) → se muestra y se filtra por idioma | `?` (TS): tolera backends antiguos
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
  questionIds?: string[] | null; // [2026-11-06]: preguntas sorteadas del intento de examen
  percent?: number | null;
  passed?: boolean | null;
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
  courseId?: string; // [2026-11-09]: examen FINAL de ese curso
  kind?: "practice" | "level"; // [2026-11-10]: tipo de examen (el final va con courseId)
  cefrLevel?: string; // A1–C2 (obligatorio en examen de nivel)
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
