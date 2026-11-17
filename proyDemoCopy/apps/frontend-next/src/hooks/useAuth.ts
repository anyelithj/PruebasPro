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
import { safeReturnPath } from "@/lib/safe-return";
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
  phone?: string; // [2026-10-24]: teléfono opcional del alta
}

export function useAuth() {
  // [Tipos derivados]: dispatch + selector tipados | [Principio]: SSOT
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.auth);
  const router = useRouter();

  // [finishLogin · 2026-11-16]: tras una sesión válida (contraseña o código 2FA) → Redux + redirección | [Principio]: DRY (login y verifyTwoFactor)
  const finishLogin = useCallback(
    (user: unknown) => {
      dispatch(authSuccess(user as never));
      // [Fix 2026-10-31]: `?from=` se enviaba pero nadie lo leía → tras caducar la sesión se vuelve a la misma pantalla | navegación completa: puede ser una pantalla del remoto Angular
      const back = safeReturnPath(new URLSearchParams(location.search).get("from"));
      if (back) location.assign(back);
      else router.push(PORTAL_ROUTES.dashboard);
    },
    [dispatch, router],
  );

  // [postAuth · 2026-11-16]: POST JSON a un Route Handler de auth y despacha el error si falla | `Promise<T | null>` (TS genérico): null = fallo ya mostrado | [Principio]: DRY
  const postAuth = useCallback(
    async <T,>(url: string, payload: unknown, fallback: string): Promise<T | null> => {
      dispatch(authStart());
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as T & { message?: string };
        if (!res.ok) {
          dispatch(authFailure(data.message ?? fallback));
          return null;
        }
        return data;
      } catch (err) {
        dispatch(authFailure(extractMessage(err)));
        return null;
      }
    },
    [dispatch],
  );

  // [login]: llama Route Handler /api/auth/login (server-side hace POST a NestJS) | [Patrón]: Facade
  // [2026-11-16 · 2FA]: devuelve el `challengeId` (string) si falta el código del correo; `true`/`false` como antes
  const login = useCallback(
    async (payload: LoginPayload): Promise<boolean | string> => {
      const data = await postAuth<{ user?: unknown; twoFactorRequired?: true; challengeId?: string }>(
        "/api/auth/login",
        payload,
        "Credenciales inválidas",
      );
      if (!data) return false;
      if (data.twoFactorRequired && data.challengeId) {
        dispatch(authLogout()); // Estado «idle»: el formulario pasa al paso del código
        return data.challengeId;
      }
      finishLogin(data.user);
      return true;
    },
    [dispatch, postAuth, finishLogin],
  );

  // [verifyTwoFactor · 2026-11-16]: segundo paso del login → /api/auth/2fa/verify pone las cookies httpOnly
  const verifyTwoFactor = useCallback(
    async (challengeId: string, code: string): Promise<boolean> => {
      const data = await postAuth<{ user?: unknown }>("/api/auth/2fa/verify", { challengeId, code }, "Código inválido");
      if (!data) return false;
      finishLogin(data.user);
      return true;
    },
    [postAuth, finishLogin],
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
    verifyTwoFactor,
    register,
    logout,
  };
}
