"use client"; // [Next.js]: Client Component → temporizador y eventos del navegador
import { useEffect } from "react";
// [SessionWatcher · 2026-10-31]: si la sesión terminó de verdad (refresh vencido o revocado) lleva al login sin esperar a que falle una acción, y al volver se regresa a la misma pantalla
// GET /api/auth/me también renueva el access token, así que una pestaña abierta conserva la sesión | [Patrón]: Observer (polling + visibilitychange) + Decorator (fetch) | [Principio]: SRP + DRY (un solo punto para las 35 llamadas a /api) | [A11y]: el login explica el motivo (`?expired=1`)

const CHECK_MS = 120_000; // Cada 2 min; al volver a la pestaña, al instante
const SESSION_URL = "/api/auth/me";

export function SessionWatcher() {
  useEffect(() => {
    const nativeFetch = window.fetch; // Referencia original: la comprobación no debe pasar por el decorador (evita el bucle)
    const check = async () => {
      if (document.visibilityState !== "visible") return; // Pestaña oculta: comprueba al volver
      // Solo 401 cierra la sesión: sin red o con el backend caído (`catch` o 5xx) se queda en la pantalla
      const res = await nativeFetch(SESSION_URL, { cache: "no-store" }).catch(() => null);
      if (res?.status === 401) location.assign(`/login?expired=1&from=${encodeURIComponent(location.pathname + location.search)}`); // `location.assign` (DOM): navegación completa, las cookies ya no sirven
    };
    const timer = setInterval(() => void check(), CHECK_MS);
    document.addEventListener("visibilitychange", check);
    // [Decorator de fetch · Fix 2026-10-31]: un 401 de /api o una Server Action redirigida al login comprueban la sesión al momento (antes se esperaba hasta 2 min viendo «Unauthorized»)
    // Es solo un aviso: decide /api/auth/me → un 401 legítimo (p. ej. contraseña actual incorrecta) no saca a nadie | `Response.redirected` (Fetch API): el navegador siguió la redirección del proxy
    window.fetch = async (...args) => {
      const res = await nativeFetch(...args);
      const { pathname } = new URL(res.url || location.href);
      if ((res.status === 401 && pathname.startsWith("/api/")) || (res.redirected && pathname === "/login")) void check();
      return res; // Respuesta intacta: quien llamó la sigue leyendo
    };
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.fetch = nativeFetch;
    };
  }, []);
  return null; // Sin interfaz
}
