"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/constants";

export function VerifyEmailForm({ token }: { token: string }) {
  const router = useRouter();
  // [Estado inicial derivado]: sin token el error se conoce desde el primer render → no hace falta setState dentro del efecto (React 19)
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState<string | null>(token ? null : "Token de verificación ausente");

  useEffect(() => {
    if (!token) return; // El estado de error ya quedó en el valor inicial
    const verify = async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
        setStatus("success");
        setMessage("¡Email verificado exitosamente! Redirigiendo...");
        setTimeout(() => router.push(AUTH_ROUTES.login), 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Error al verificar email");
      }
    };
    verify();
  }, [token, router]);

  return (
    <div
      className="w-full max-w-[420px] space-y-5 text-center"
      aria-label="Verificación de email"
    >
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Verificar email</h1>
      </header>

      {message && (
        <div
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            status === "error"
              ? "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : status === "success"
                ? "rounded-lg border border-primary/20 bg-gradient-soft px-4 py-3 text-sm text-foreground"
                : "rounded-lg border border-muted bg-muted/10 px-4 py-3 text-sm text-muted-foreground"
          }
        >
          {status === "loading" ? "Verificando..." : message}
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-muted-foreground">
          Solicita un nuevo enlace desde{" "}
          <Link
            href={AUTH_ROUTES.login}
            className="font-semibold text-primary hover:text-primary-dark"
          >
            iniciar sesión
          </Link>
          .
        </p>
      )}

      {status === "success" && (
        <Button
          onClick={() => router.push(AUTH_ROUTES.login)}
          className="btn-lg"
        >
          Ir a iniciar sesión
        </Button>
      )}
    </div>
  );
}
