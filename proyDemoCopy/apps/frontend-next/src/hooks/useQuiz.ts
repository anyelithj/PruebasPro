"use client";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  finish,
  loadStart,
  loadQuiz,
  nextQuestion,
  pause,
  resume,
  selectAnswer,
  selectCurrentQuestion,
  selectProgress,
  sessionStarted,
  setError,
  submitStart,
  submitSuccess,
} from "@/store/slices/quizSlice";
import { extractMessage } from "@/lib/errors";
import type { Quiz, QuizSession, SubmitAnswerInput } from "@/types/quiz";
// [Hook useQuiz]: API uniforme para la sesion de juego desde Client Components | [Patron]: Custom Hook + Facade | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo

export function useQuiz() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.quiz);
  const currentQuestion = useSelector(selectCurrentQuestion);
  const progress = useSelector(selectProgress);

  // [hydrate]: monta quiz cargado SSR en el slice | [Patron]: Hydration
  const hydrate = useCallback(
    (quiz: Quiz) => {
      dispatch(loadStart());
      dispatch(loadQuiz(quiz));
    },
    [dispatch],
  );

  // [start]: POST /api/quiz/[id]/session via route handler local
  const start = useCallback(
    async (quizId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/quiz/${quizId}/session`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json()) as { message?: string };
          dispatch(setError(body.message ?? "No se pudo iniciar la sesión"));
          return false;
        }
        const session = (await res.json()) as QuizSession;
        dispatch(sessionStarted(session));
        return true;
      } catch (err) {
        dispatch(setError(extractMessage(err)));
        return false;
      }
    },
    [dispatch],
  );

  // [submit]: POST /api/quiz/session/[sessionId]/answer
  const submit = useCallback(
    async (input: SubmitAnswerInput): Promise<boolean> => {
      if (!state.session) {
        dispatch(setError("No hay sesión activa"));
        return false;
      }
      dispatch(submitStart());
      try {
        const res = await fetch(
          `/api/quiz/session/${state.session.id}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        if (!res.ok) {
          const body = (await res.json()) as { message?: string };
          dispatch(setError(body.message ?? "Error al enviar respuesta"));
          return false;
        }
        const data = (await res.json()) as {
          session: QuizSession;
          isCorrect: boolean;
          score: number;
          feedback?: string | null;
          strategy?: string;
        };
        dispatch(submitSuccess(data));
        return true;
      } catch (err) {
        dispatch(setError(extractMessage(err)));
        return false;
      }
    },
    [dispatch, state.session],
  );

  // [end]: POST /api/quiz/session/[sessionId]/end
  const end = useCallback(
    async (abandon = false): Promise<QuizSession | null> => {
      if (!state.session) return null;
      try {
        const res = await fetch(
          `/api/quiz/session/${state.session.id}/end?abandon=${abandon}`,
          { method: "POST" },
        );
        if (!res.ok) return null;
        const session = (await res.json()) as QuizSession;
        dispatch(finish(session));
        return session;
      } catch {
        return null;
      }
    },
    [dispatch, state.session],
  );

  return {
    ...state,
    currentQuestion,
    progress,
    hydrate,
    start,
    submit,
    advance: () => dispatch(nextQuestion()),
    selectAnswer: (a: string) => dispatch(selectAnswer(a)),
    pause: () => dispatch(pause()),
    resume: () => dispatch(resume()),
    end,
  };
}
