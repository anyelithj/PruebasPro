"use client"; // [Next.js]: Client Component → formulario interactivo con estado local
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos y validaciones del idioma activo
import { makeForgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";
import { AUTH_ROUTES } from "@/lib/constants";
// [ForgotPasswordForm]: pide el correo y solicita el enlace al BFF /api/auth/forgot-password | [Patrón]: Presentational + Container + State Machine (status) | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo + Declarativo
// [Seguridad]: el mensaje de éxito es genérico → no revela si el correo existe (anti-enumeración)

// [Estados del envío]: unión de literales (TS) → máquina de estados finita y exhaustiva
type Status = "idle" | "sending" | "sent" | "error";

export function ForgotPasswordForm() {
  const { t } = usePreferences();
  const a = t.auth; // Alias de textos de autenticación
  const f = a.forgot; // Alias de textos de esta pantalla
  // `useMemo` (React): el esquema Zod solo se reconstruye al cambiar de idioma | [Patrón]: Factory
  const schema = useMemo(() => makeForgotPasswordSchema(a.validation), [a.validation]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // [useForm]: React Hook Form + zodResolver → validación en cliente con los mismos mensajes del login | [Patrón]: Form State
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  // [onSubmit]: `handleSubmit` solo llama al callback si Zod aprueba | `async/await` (ES2017)
  const onSubmit = handleSubmit(async ({ email }) => {
    setStatus("sending");
    setMessage(null);
    try {
      // [BFF]: Route Handler de Next que valida y reenvía al backend NestJS | [Patrón]: Backend For Frontend
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // 429 = límite de intentos del backend (@Throttle) → mensaje específico; otro error → genérico
      if (!res.ok) throw new Error(res.status === 429 ? f.tooMany : f.error);
      setStatus("sent");
      setMessage(f.sent);
    } catch (err) {
      setStatus("error");
      // `instanceof` (JS): fetch lanza TypeError sin red → texto genérico; nuestros Error ya vienen traducidos
      setMessage(err instanceof TypeError ? f.error : (err as Error).message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px] space-y-5" noValidate aria-label={f.formLabel}>
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{f.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{f.subtitle}</p>
      </header>

      {/* [Live region]: `role` + `aria-live` (WAI-ARIA) → el lector de pantalla anuncia el resultado */}
      {message && (
        <div
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            status === "error"
              ? "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : "rounded-lg border border-primary/20 bg-gradient-soft px-4 py-3 text-sm text-foreground"
          }
        >
          {message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">{a.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={a.email.toLowerCase()}
          aria-invalid={!!errors.email} // `!!` (JS): convierte a boolean
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")} // Spread de props de RHF (name, ref, onChange, onBlur)
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={status === "sending"} className="btn-lg w-full">
        {/* [Ternario anidado]: texto del botón según el estado */}
        {status === "sending" ? f.submitting : status === "sent" ? f.resend : f.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {f.remembered}{" "}
        <Link href={AUTH_ROUTES.login} className="font-semibold text-primary hover:text-primary-dark">
          {a.login.submit}
        </Link>
      </p>
    </form>
  );
}
