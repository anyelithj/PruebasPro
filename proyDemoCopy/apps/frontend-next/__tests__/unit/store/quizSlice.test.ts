// [Test quizSlice]: máquina de estados de juego + selectors | [Patrón]: Unit Test reducer | [Principio]: FP
import quizReducer, {
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
  selectCurrentQuestion,
  selectProgress,
  selectAnswers,
  selectFeedbacks,
} from "@/store/slices/quizSlice";
import type { Quiz, QuizSession, QuestionPublic } from "@/types/quiz";

// [fixtures]: quiz mínimo con 2 preguntas
const q1: QuestionPublic = {
  id: "q1",
  text: "2+2?",
  type: "multiple_choice",
  options: ["3", "4"],
  difficulty: "easy",
  position: 0,
};
const q2: QuestionPublic = {
  id: "q2",
  text: "Cielo?",
  type: "multiple_choice",
  options: ["Azul", "Verde"],
  difficulty: "easy",
  position: 1,
};
const quiz: Quiz = {
  id: "quiz1",
  title: "Demo",
  category: "general",
  difficulty: "easy",
  authorId: "a1",
  source: "manual",
  timePerQuestionSeconds: 30,
  isPublished: true,
  createdAt: "2026-01-01",
  questions: [q1, q2],
};
const baseSession: QuizSession = {
  id: "s1",
  userId: "u1",
  quizId: "quiz1",
  status: "in_progress",
  answers: [],
  totalScore: 0,
  correctCount: 0,
  startedAt: "2026-01-01",
};

describe("quizSlice reducer", () => {
  it("estado inicial es idle", () => {
    const state = quizReducer(undefined, { type: "@@INIT" });
    expect(state.phase).toBe("idle");
    expect(state.quiz).toBeNull();
  });

  it("loadStart pasa a loading", () => {
    expect(quizReducer(undefined, loadStart()).phase).toBe("loading");
  });

  it("loadQuiz guarda quiz y resetea cursor/feedbacks", () => {
    const state = quizReducer(undefined, loadQuiz(quiz));
    expect(state.quiz).toEqual(quiz);
    expect(state.currentIndex).toBe(0);
    expect(state.feedbacks).toEqual({});
    expect(state.phase).toBe("idle");
  });

  it("sessionStarted guarda sesión y pasa a playing", () => {
    const state = quizReducer(undefined, sessionStarted(baseSession));
    expect(state.session).toEqual(baseSession);
    expect(state.phase).toBe("playing");
  });

  it("selectAnswer guarda la opción seleccionada", () => {
    expect(quizReducer(undefined, selectAnswer("4")).selectedAnswer).toBe("4");
  });

  it("submitStart bloquea con phase submitting", () => {
    expect(quizReducer(undefined, submitStart()).phase).toBe("submitting");
  });

  it("submitSuccess guarda resultado y feedback por questionId", () => {
    const session: QuizSession = {
      ...baseSession,
      answers: [
        {
          questionId: "q1",
          userAnswer: "4",
          isCorrect: true,
          score: 100,
          timeTakenMs: 1200,
          answeredAt: "2026-01-01",
        },
      ],
    };
    const state = quizReducer(
      undefined,
      submitSuccess({ session, isCorrect: true, score: 100, feedback: "bien", strategy: "rule" }),
    );
    expect(state.lastResult).toEqual({ isCorrect: true, score: 100, feedback: "bien" });
    expect(state.feedbacks["q1"]).toEqual({ questionId: "q1", feedback: "bien", strategy: "rule" });
    expect(state.phase).toBe("playing");
  });

  it("nextQuestion avanza el cursor y finaliza al llegar al final", () => {
    const loaded = quizReducer(undefined, loadQuiz(quiz));
    const advanced = quizReducer(loaded, nextQuestion());
    expect(advanced.currentIndex).toBe(1);
    expect(advanced.selectedAnswer).toBeNull();
    const finished = quizReducer(advanced, nextQuestion());
    expect(finished.phase).toBe("finished");
  });

  it("pause/resume solo transicionan desde el estado válido", () => {
    const playing = quizReducer(undefined, sessionStarted(baseSession));
    const paused = quizReducer(playing, pause());
    expect(paused.phase).toBe("paused");
    expect(quizReducer(paused, resume()).phase).toBe("playing");
    // [guard]: pause desde idle no hace nada
    expect(quizReducer(undefined, pause()).phase).toBe("idle");
  });

  it("finish marca finished con la sesión final", () => {
    const state = quizReducer(undefined, finish(baseSession));
    expect(state.phase).toBe("finished");
    expect(state.session).toEqual(baseSession);
  });

  it("setError guarda error y phase error", () => {
    const state = quizReducer(undefined, setError("boom"));
    expect(state.phase).toBe("error");
    expect(state.error).toBe("boom");
  });

  it("reset vuelve al estado inicial", () => {
    const loaded = quizReducer(undefined, loadQuiz(quiz));
    expect(quizReducer(loaded, reset()).phase).toBe("idle");
  });
});

describe("quizSlice selectors", () => {
  const loaded = quizReducer(undefined, loadQuiz(quiz));

  it("selectCurrentQuestion devuelve la pregunta del índice actual", () => {
    expect(selectCurrentQuestion({ quiz: loaded })).toEqual(q1);
  });

  it("selectCurrentQuestion devuelve null sin quiz", () => {
    const empty = quizReducer(undefined, { type: "@@INIT" });
    expect(selectCurrentQuestion({ quiz: empty })).toBeNull();
  });

  it("selectProgress calcula current/total/percent", () => {
    expect(selectProgress({ quiz: loaded })).toEqual({ current: 1, total: 2, percent: 50 });
  });

  it("selectAnswers devuelve [] sin sesión", () => {
    expect(selectAnswers({ quiz: loaded })).toEqual([]);
  });

  it("selectFeedbacks devuelve el mapa de feedbacks", () => {
    expect(selectFeedbacks({ quiz: loaded })).toEqual({});
  });
});
