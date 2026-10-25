"use client"; // [Next.js]: Client Component → formulario interactivo + redirección en cliente
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos y validaciones del idioma activo
import { makeResetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";
import { AUTH_ROUTES } from "@/lib/constants";
// [ResetPasswordForm]: recibe el token del enlace (query) y envía la nueva contraseña al BFF /api/auth/reset-password | [Patrón]: Presentational + Container + State Machine | [Principio]: SRP + DRY (esquema compartido con registro) | [Paradigma]: Funcional + Reactivo + Declarativo

type Status = "idle" | "sending" | "success" | "error"; // Unión de literales (TS): estados posibles del envío

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = usePreferences();
  const a = t.auth;
  const r = a.reset; // Alias de textos de esta pantalla
  // `useMemo` (React): esquema Zod con mensajes del idioma activo | [Patrón]: Factory
  const schema = useMemo(() => makeResetPasswordSchema(a.validation), [a.validation]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // [Redirección tras éxito]: `useEffect` + cleanup `clearTimeout` → sin fugas si el componente se desmonta antes | [Paradigma]: Reactivo
  useEffect(() => {
    if (status !== "success") return;
    const id = setTimeout(() => router.push(AUTH_ROUTES.login), 1500);
    return () => clearTimeout(id);
  }, [status, router]);

  const onSubmit = handleSubmit(async (values) => {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      // 400 = token inválido/expirado/usado (backend) → pedir enlace nuevo; otro código → error genérico
      if (!res.ok) throw new Error(res.status === 400 ? r.invalid : r.error);
      setStatus("success");
      setMessage(r.success);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof TypeError ? r.error : (err as Error).message);
    }
  });

  // [Guard clause]: sin token no tiene sentido mostrar el formulario | [Principio]: Fail fast
  if (!token) {
    return (
      <div className="w-full max-w-[420px] space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{r.missingTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {r.missingA}
          <Link href={AUTH_ROUTES.forgotPassword} className="font-semibold text-primary hover:text-primary-dark">
            {r.missingLink}
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="w-full max-w-[420px] space-y-5" noValidate aria-label={r.formLabel}>
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{r.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{r.subtitle}</p>
      </header>

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
          {/* [UX]: token caducado → atajo directo para pedir otro enlace */}
          {status === "error" && message === r.invalid && (
            <>
              {" "}
              <Link href={AUTH_ROUTES.forgotPassword} className="font-semibold underline">
                {r.requestNew}
              </Link>
            </>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{r.newPassword}</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password" // Pista al gestor de contraseñas (HTML) para sugerir una nueva
          placeholder="••••••••"
          aria-invalid={!!errors.newPassword}
          aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p id="newPassword-error" role="alert" className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{r.confirm}</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" role="alert" className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={status === "sending" || status === "success"} className="btn-lg w-full">
        {status === "sending" ? r.submitting : r.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {r.remembered}{" "}
        <Link href={AUTH_ROUTES.login} className="font-semibold text-primary hover:text-primary-dark">
          {a.login.submit}
        </Link>
      </p>
    </form>
  );
}
