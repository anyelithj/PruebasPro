"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
// [Error Boundary global]: requerido Client Component por uso de event handlers | [Patrón]: Error Boundary | [Principio]: SRP | [Paradigma]: Funcional + JSX

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  // [Log al servidor opcional]: side-effect en mount cuando se monta el error
  useEffect(() => {
    // [TODO Sprint 5]: enviar a Sentry/Datadog | [Buena práctica]: observabilidad
    // eslint-disable-next-line no-console
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Algo salió mal</h1>
        <p className="text-muted-foreground">
          Se produjo un error inesperado. Intenta nuevamente o vuelve más tarde.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground">
            ID del error: {error.digest}
          </p>
        )}
        <Button onClick={reset} className="bg-gradient-brand text-white">
          Reintentar
        </Button>
      </div>
    </main>
  );
}
