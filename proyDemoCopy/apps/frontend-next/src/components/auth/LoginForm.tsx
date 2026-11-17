"use client";
import { useMemo, useState, type FormEvent } from "react"; // `useState` (React): guarda el reto 2FA entre los dos pasos
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
  const { login, verifyTwoFactor, isLoading, error } = useAuth();
  // [2FA · 2026-11-16]: `null` = paso 1 (correo + contraseña) · string = paso 2 (código del correo) | [Patrón]: State (máquina de 2 pasos)
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const { t } = usePreferences();
  const a = t.auth; // Alias de textos de autenticación
  const params = useSearchParams();
  const magicInvalid = params.get("magic") === "invalid";
  const sessionExpired = params.get("expired") === "1"; // [2026-10-31]: venimos de una sesión terminada → se explica el motivo
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
    const res = await login({ email: values.email, password: values.password });
    if (typeof res === "string") setChallengeId(res); // `typeof` (JS): string = challengeId → mostrar el paso del código
  });

  // [Paso 2]: mismo contenedor y estilos; el resto del formulario no se muestra | [Principio]: SRP (TwoFactorStep)
  if (challengeId) {
    return (
      <TwoFactorStep
        isLoading={isLoading}
        error={error}
        onVerify={(code) => verifyTwoFactor(challengeId, code)}
        onBack={() => setChallengeId(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-[420px] space-y-5">
      <header className="mb-2">
        <h1 className="title-page">{a.login.title}</h1>
        <p className="mt-2 text-muted-foreground">
          {fmt(a.login.subtitle, { brand: BRAND.name })}
        </p>
      </header>

      {sessionExpired && !error && (
        <div role="status" className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-4 py-3 text-sm text-tone-warning">
          {a.login.sessionExpired}
        </div>
      )}

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
            <p id="email-error" role="alert" className="type-meta text-destructive">
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
            <p id="password-error" role="alert" className="type-meta text-destructive">
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

      <p className="text-center text-muted-foreground mt-6">
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

// [TwoFactorStep · 2026-11-16]: formulario del código OTP de 6 dígitos | [Patrón]: Presentational Component | [Accesibilidad]: label + role="alert" + `inputMode="numeric"` (teclado numérico en móvil) + `autoComplete="one-time-code"` (autocompleta el código en iOS/Android)
function TwoFactorStep({
  isLoading,
  error,
  onVerify,
  onBack,
}: {
  isLoading: boolean;
  error: string | null;
  onVerify: (code: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const { t } = usePreferences();
  const tf = t.auth.twoFactor; // Alias de textos del 2FA
  const [code, setCode] = useState("");
  const [formatError, setFormatError] = useState(false);

  // [onSubmit]: valida 6 dígitos en cliente (el servidor vuelve a validar) | `preventDefault` (DOM): evita el envío nativo
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = /^\d{6}$/.test(code);
    setFormatError(!ok);
    if (ok) await onVerify(code);
  };
  const shownError = formatError ? tf.invalidFormat : error;

  return (
    <div className="w-full max-w-[420px] space-y-5">
      <header className="mb-2">
        <h1 className="title-page">{tf.title}</h1>
        <p className="mt-2 text-muted-foreground">{tf.intro}</p>
      </header>
      {shownError && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {shownError}
        </div>
      )}
      <form method="post" onSubmit={onSubmit} noValidate className="space-y-5" aria-label={tf.title}>
        <div className="space-y-1.5">
          <Label htmlFor="otp-code">{tf.code}</Label>
          <Input
            id="otp-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            autoFocus
            placeholder="123456"
            className="text-center font-mono text-lg tracking-[0.4em]"
            aria-invalid={!!shownError}
            value={code}
            // [Solo dígitos]: `replace` con regex quita lo que no sea número (pegar «123 456» funciona)
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        <Button type="submit" disabled={isLoading} className="btn-lg btn-cta w-full">
          {isLoading ? tf.submitting : tf.submit}
        </Button>
      </form>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-semibold text-primary hover:text-primary-dark">
        {tf.back}
      </button>
    </div>
  );
}
