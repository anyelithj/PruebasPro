import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AnswerFeedback,
  Quiz,
  QuestionPublic,
  SessionAnswer,
  QuizSession,
} from "@/types/quiz";
// [Slice Quiz Game]: maquina de estados de la sesion de juego | [Patron]: State + Redux Slice | [Principio]: SRP | [Paradigma]: FP + Inmutabilidad

// [Estado de juego]: maquina | [Patron]: State Machine
export type QuizPhase = "idle" | "loading" | "playing" | "paused" | "submitting" | "finished" | "error";

export interface QuizState {
  phase: QuizPhase;
  quiz: Quiz | null;
  session: QuizSession | null;
  currentIndex: number;
  selectedAnswer: string | null;
  lastResult: { isCorrect: boolean; score: number; feedback: string | null } | null;
  // [Feedbacks por pregunta]: indexado por questionId para la página de resultados | [Patrón]: Lookup Map
  feedbacks: Record<string, AnswerFeedback>;
  error: string | null;
}

const initialState: QuizState = {
  phase: "idle",
  quiz: null,
  session: null,
  currentIndex: 0,
  selectedAnswer: null,
  lastResult: null,
  feedbacks: {},
  error: null,
};

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    // [loadStart]: marca inicio de carga del quiz | [Patron]: Action
    loadStart(state) {
      state.phase = "loading";
      state.error = null;
    },
    // [loadQuiz]: tras GET /quiz/:id
    loadQuiz(state, action: PayloadAction<Quiz>) {
      state.quiz = action.payload;
      state.currentIndex = 0;
      state.selectedAnswer = null;
      state.lastResult = null;
      state.feedbacks = {};
      state.phase = "idle";
    },
    // [sessionStarted]: tras POST /quiz/:id/session
    sessionStarted(state, action: PayloadAction<QuizSession>) {
      state.session = action.payload;
      state.phase = "playing";
    },
    // [selectAnswer]: seleccion local antes de submit
    selectAnswer(state, action: PayloadAction<string>) {
      state.selectedAnswer = action.payload;
    },
    // [submitStart]: lock UI durante POST /answer
    submitStart(state) {
      state.phase = "submitting";
    },
    // [submitSuccess]: resultado individual + avanza session.answers + guarda feedback
    submitSuccess(
      state,
      action: PayloadAction<{
        session: QuizSession;
        isCorrect: boolean;
        score: number;
        feedback?: string | null;
        strategy?: string;
      }>,
    ) {
      state.session = action.payload.session;
      const feedback = action.payload.feedback ?? null;
      state.lastResult = {
        isCorrect: action.payload.isCorrect,
        score: action.payload.score,
        feedback,
      };
      // [Persistir feedback por questionId]: la results page lo consume | [Principio]: SSOT
      const lastAnswer = action.payload.session.answers[action.payload.session.answers.length - 1];
      if (lastAnswer) {
        state.feedbacks[lastAnswer.questionId] = {
          questionId: lastAnswer.questionId,
          feedback,
          strategy: action.payload.strategy ?? "unknown",
        };
      }
      state.phase = "playing";
    },
    // [nextQuestion]: avanza el cursor (chequea fin)
    nextQuestion(state) {
      state.selectedAnswer = null;
      state.lastResult = null;
      if (state.quiz && state.currentIndex + 1 < (state.quiz.questions?.length ?? 0)) {
        state.currentIndex += 1;
      } else {
        state.phase = "finished";
      }
    },
    // [pause / resume]: pausa temporal
    pause(state) {
      if (state.phase === "playing") state.phase = "paused";
    },
    resume(state) {
      if (state.phase === "paused") state.phase = "playing";
    },
    // [finish]: marca finalizado tras endSession
    finish(state, action: PayloadAction<QuizSession>) {
      state.session = action.payload;
      state.phase = "finished";
    },
    // [setError]
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.phase = "error";
    },
    // [reset]: limpia para nuevo juego
    reset() {
      return initialState;
    },
  },
});

export const {
  loadStart,
  loadQuiz,
  sessionStarted,
  selectAnswer,
  submitStart,
  submitSuccess,
  nextQuestion,
  pause,
  resume,
  finish,
  setError,
  reset,
} = quizSlice.actions;

export default quizSlice.reducer;

// [Selectors]: lectura tipada del estado | [Principio]: DRY | [Patron]: Selector
export const selectCurrentQuestion = (state: { quiz: QuizState }): QuestionPublic | null => {
  const { quiz, currentIndex } = state.quiz;
  return quiz?.questions?.[currentIndex] ?? null;
};

// [selectProgress memoizado]: evita re-render por nuevo objeto en cada call | [Patrón]: Memoized Selector
export const selectProgress = createSelector(
  [
    (state: { quiz: QuizState }) => state.quiz.currentIndex,
    (state: { quiz: QuizState }) => state.quiz.quiz?.questions?.length ?? 0,
  ],
  (currentIndex, total) => ({
    current: currentIndex + 1,
    total,
    percent: total > 0 ? ((currentIndex + 1) / total) * 100 : 0,
  }),
);

export const selectAnswers = (state: { quiz: QuizState }): SessionAnswer[] =>
  state.quiz.session?.answers ?? [];

export const selectFeedbacks = (state: { quiz: QuizState }): Record<string, AnswerFeedback> =>
  state.quiz.feedbacks;
