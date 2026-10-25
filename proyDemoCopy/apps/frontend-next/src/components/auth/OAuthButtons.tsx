"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithGoogle } from "@/app/(auth)/login/oauth-actions"; // [2026-10-24]: solo Google (Microsoft retirado a pedido del usuario)
import { fmt } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos del idioma activo
// [OAuthButtons]: dispara server actions Auth.js v5 (Google) | [Patrón]: Presentational + Server Action | [Principio]: SRP

// [Icono Google]: SVG inline para evitar dep externa
const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export function OAuthButtons() {
  const o = usePreferences().t.auth.oauth; // [i18n]: textos del idioma activo
  const [pending, setPending] = useState<"google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // [isRedirectError]: NEXT_REDIRECT es excepción de control de flujo, no error real | [Principio]: SSOT
  const isRedirectError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const e = err as { message?: string; digest?: string };
    return (
      e.message === "NEXT_REDIRECT" ||
      (typeof e.digest === "string" && e.digest.startsWith("NEXT_REDIRECT"))
    );
  };

  // [Wrap action]: convierte server action en handler client con loading state | [Patrón]: Adapter
  const run = (id: "google", action: () => Promise<void>) => async () => {
    setError(null);
    setPending(id);
    try {
      await action();
    } catch (err) {
      // [Re-throw redirect]: Next.js usa esta excepción para navegar — no la traguemos
      if (isRedirectError(err)) throw err;
      setPending(null);
      setError(err instanceof Error ? err.message : o.error);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="text-xs text-destructive">
          {error}
        </div>
      )}
      {/* [2026-10-24]: UN botón (Google) a todo el ancho · `btn-cta` = mismo radio que los botones morados del formulario */}
      <Button
        type="button"
        variant="outline"
        disabled={pending !== null}
        onClick={run("google", signInWithGoogle)}
        aria-label={fmt(o.withProvider, { provider: "Google" })}
        className="btn-cta w-full flex-row gap-2"
      >
        {GoogleIcon}
        <span className="text-xs">{pending === "google" ? o.connecting : "Google"}</span>
      </Button>
    </div>
  );
}

// [MagicLinkForm · Sprints 1.5/7.18]: pide el enlace de acceso sin contraseña (BFF /api/auth/magic-link → NestJS) | [Patrón]: Presentational + estado local | [A11y]: resultado en role="status" (aria-live) · [i18n]: textos del diccionario
export function MagicLinkForm() {
  const { t } = usePreferences();
  const m = t.auth.magic;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setStatus("sent");
      setMessage(m.sent); // Genérico: no revela si la cuenta existe
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : m.error);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <Label htmlFor="magic-email" className="text-xs">
        {m.label}
      </Label>
      <div className="flex gap-2">
        <Input
          id="magic-email"
          type="email"
          placeholder={m.placeholder}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={status === "sending"}
          className="btn-cta h-10 shrink-0" // [2026-10-24]: mismo radio que los botones morados
        >
          {status === "sending" ? m.sending : m.send}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className={
            status === "error"
              ? "text-xs text-destructive"
              : "text-xs text-tone-brand"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
