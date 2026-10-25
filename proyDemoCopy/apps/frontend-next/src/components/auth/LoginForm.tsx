"use client";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/useAuth";
import { makeLoginSchema, type LoginInput } from "@/lib/validations";
import { fmt } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos y validaciones del idioma activo
import { AUTH_ROUTES } from "@/lib/constants";
import { MagicLinkForm, OAuthButtons } from "@/components/auth/OAuthButtons";
import { useSearchParams } from "next/navigation"; // [Sprint 7.18]: ?magic=invalid cuando el enlace caducó o ya se usó
import { BRAND } from "@/config/brand";
// [LoginForm]: form controlado RHF + Zod | [Patrón]: Presentational + Container | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo + Declarativo

export function LoginForm() {
  // [useAuth]: estado + dispatch login | [Patrón]: Custom Hook
  const { login, isLoading, error } = useAuth();
  const { t } = usePreferences();
  const a = t.auth; // Alias de textos de autenticación
  const magicInvalid = useSearchParams().get("magic") === "invalid";
  // `useMemo` (React): el esquema solo se reconstruye al cambiar de idioma | [Patrón]: Factory
  const schema = useMemo(() => makeLoginSchema(a.validation), [a.validation]);

  // [useForm]: registra el form + Zod resolver | [Patrón]: Form State
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false } as LoginInput,
  });

  // [onSubmit]: ya validado por Zod, llama useAuth.login | [Principio]: SRP
  const onSubmit = handleSubmit(async (values) => {
    await login({ email: values.email, password: values.password });
  });

  return (
    <div className="w-full max-w-[420px] space-y-5">
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{a.login.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fmt(a.login.subtitle, { brand: BRAND.name })}
        </p>
      </header>

      {magicInvalid && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {a.magic.invalid}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}


      <form
        method="post" // [Seguridad]: si el JS aún no hidrató, el envío nativo NO pone la contraseña en la URL (GET la dejaría en historial y logs)
        onSubmit={onSubmit}
        className="space-y-5"
        noValidate
        aria-label={a.login.formLabel}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">{a.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={a.email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{a.password}</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              {...register("remember")}
            />
            {a.login.remember}
          </label>
          <Link
            href={AUTH_ROUTES.forgotPassword}
            className="font-semibold text-primary hover:text-primary-dark"
          >
            {a.login.forgot}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="btn-lg btn-cta w-full" // [2026-10-23 · 4.º pase]: mismo radio que «Comenzar gratis»
        >
          {isLoading ? a.login.submitting : a.login.submit}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground my-5">
        <span className="flex-1 h-px bg-border" />
        {a.or}
        <span className="flex-1 h-px bg-border" />
      </div>

      <OAuthButtons />
      <MagicLinkForm />

      <p className="text-center text-sm text-muted-foreground mt-6">
        {a.login.noAccount}{" "}
        <Link
          href={AUTH_ROUTES.register}
          className="font-semibold text-primary hover:text-primary-dark"
        >
          {a.login.registerLink}
        </Link>
      </p>
    </div>
  );
}
