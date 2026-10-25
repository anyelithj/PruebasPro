"use client";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  authFailure,
  authLogout,
  authStart,
  authSuccess,
} from "@/store/slices/authSlice";
import type { AppDispatch, RootState } from "@/store";
import { extractMessage } from "@/lib/errors";
import { AUTH_ROUTES, PORTAL_ROUTES } from "@/lib/constants";
// [Hook useAuth]: API uniforme para login/register/logout desde Client Components | [Patrón]: Custom Hook + Facade | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo

interface LoginPayload {
  email: string;
  password: string;
}
interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function useAuth() {
  // [Tipos derivados]: dispatch + selector tipados | [Principio]: SSOT
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.auth);
  const router = useRouter();

  // [login]: llama Route Handler /api/auth/login (server-side hace POST a NestJS) | [Patrón]: Facade
  const login = useCallback(
    async (payload: LoginPayload): Promise<boolean> => {
      dispatch(authStart());
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { user?: unknown; message?: string };
        if (!res.ok) {
          dispatch(authFailure(data.message ?? "Credenciales inválidas"));
          return false;
        }
        dispatch(authSuccess(data.user as never));
        router.push(PORTAL_ROUTES.dashboard);
        return true;
      } catch (err) {
        dispatch(authFailure(extractMessage(err)));
        return false;
      }
    },
    [dispatch, router],
  );

  // [register]: simétrico a login
  const register = useCallback(
    async (payload: RegisterPayload): Promise<boolean> => {
      dispatch(authStart());
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { user?: unknown; message?: string };
        if (!res.ok) {
          dispatch(authFailure(data.message ?? "No se pudo registrar"));
          return false;
        }
        dispatch(authSuccess(data.user as never));
        router.push(PORTAL_ROUTES.dashboard);
        return true;
      } catch (err) {
        dispatch(authFailure(extractMessage(err)));
        return false;
      }
    },
    [dispatch, router],
  );

  // [logout]: limpia cliente + server (Route Handler revoca refresh y borra cookies)
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // [Tolerante]: aunque falle network, limpiamos estado local
    }
    dispatch(authLogout());
    router.push(AUTH_ROUTES.login);
  }, [dispatch, router]);

  return {
    user: state.user,
    status: state.status,
    error: state.error,
    isAuthenticated: state.status === "authenticated",
    isLoading: state.status === "authenticating",
    login,
    register,
    logout,
  };
}
