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
import { makeRegisterSchema, type RegisterInput } from "@/lib/validations";
import { fmt } from "@aula/shared-i18n";
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER } from "@aula/shared-schemas"; // [2026-10-24]: límite y ejemplo del teléfono compartidos con Mi perfil y Gestión | [Principio]: SSOT
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos y validaciones del idioma activo
import { AUTH_ROUTES } from "@/lib/constants";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { BRAND } from "@/config/brand";
// [RegisterForm]: form crear cuenta | [Patrón]: Presentational + Container | [Principio]: SRP | [Paradigma]: Funcional + Reactivo

export function RegisterForm() {
  const { register: registerUser, isLoading, error } = useAuth();
  const { t } = usePreferences();
  const a = t.auth;
  const r = a.register;
  const schema = useMemo(() => makeRegisterSchema(a.validation), [a.validation]); // [Factory]: mensajes del idioma activo
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "", // [2026-10-24]: opcional → "" = sin teléfono
      password: "",
      confirmPassword: "",
      acceptTerms: undefined as unknown as true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await registerUser({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      // `||` (JS): "" (falsy) → undefined → el campo no viaja y el usuario queda sin teléfono
      phone: values.phone || undefined,
    });
  });

  return (
    <form
      method="post" // [Seguridad]: si el JS aún no hidrató, el envío nativo NO pone la contraseña en la URL (GET la dejaría en historial y logs)
        onSubmit={onSubmit}
      className="w-full max-w-[420px] space-y-5"
      noValidate
      aria-label={r.formLabel}
    >
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{r.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fmt(r.subtitle, { brand: BRAND.name })}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* [Nombre + Apellido]: grid 2 cols como en Demohtml */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{r.firstName}</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            placeholder={r.firstName}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p id="firstName-error" role="alert" className="text-xs text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">{r.lastName}</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            placeholder={r.lastName}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p id="lastName-error" role="alert" className="text-xs text-destructive">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      {/* [Email] */}
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

      {/* [Teléfono · 2026-10-24]: opcional | `type="tel"` (HTML5) + `inputMode="tel"` → teclado numérico en móvil · `autoComplete="tel"` → autocompletado del navegador
          [A11y]: `aria-describedby` enlaza la pista (y el error si existe) para lectores de pantalla · mismo <Input> (utilidad `control`, min-h-10) → misma altura que el resto */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">{r.phone}</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={PHONE_PLACEHOLDER}
          maxLength={PHONE_MAX_LENGTH}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "phone-hint phone-error" : "phone-hint"}
          {...register("phone")}
        />
        <p id="phone-hint" className="text-xs text-muted-foreground">
          {r.phoneHint}
        </p>
        {errors.phone && (
          <p id="phone-error" role="alert" className="text-xs text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      {/* [Password + Confirm] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="password">{a.password}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
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
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{r.confirm}</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? "confirmPassword-error" : undefined
            }
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p
              id="confirmPassword-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      {/* [Terms] */}
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input accent-primary"
          aria-invalid={!!errors.acceptTerms}
          {...register("acceptTerms")}
        />
        <span>
          {r.termsA}
          <Link
            href={AUTH_ROUTES.terms}
            className="font-semibold text-primary hover:text-primary-dark"
          >
            {r.termsLink}
          </Link>
        </span>
      </label>
      {errors.acceptTerms && (
        <p role="alert" className="text-xs text-destructive -mt-3">
          {errors.acceptTerms.message}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="btn-lg btn-cta w-full" // [2026-10-23 · 4.º pase]: mismo radio que «Comenzar gratis»
      >
        {isLoading ? r.submitting : r.submit}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground my-5">
        <span className="flex-1 h-px bg-border" />
        {a.orRegister}
        <span className="flex-1 h-px bg-border" />
      </div>

      <OAuthButtons />

      <p className="text-center text-sm text-muted-foreground mt-5">
        {r.hasAccount}{" "}
        <Link
          href={AUTH_ROUTES.login}
          className="font-semibold text-primary hover:text-primary-dark"
        >
          {r.loginLink}
        </Link>
      </p>
    </form>
  );
}
