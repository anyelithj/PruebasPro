"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// [Página Feedback IA /assistant]: feedback ad-hoc del tutor IA | [Patron]: Container + Presentational | [Principio]: SRP | [Paradigma]: Funcional + Reactivo

// [Schema Zod]: validación cliente del form de feedback ad-hoc | [Patrón]: Schema Validation | [Principio]: SSOT
const feedbackSchema = z.object({
  questionText: z.string().trim().min(1, "Escribe la pregunta").max(2000),
  correctAnswer: z.string().trim().min(1, "Escribe la respuesta correcta").max(2000),
  userAnswer: z.string().trim().min(1, "Escribe la respuesta").max(2000),
  topic: z.string().trim().max(80).optional(),
});

type FeedbackForm = z.input<typeof feedbackSchema>;

interface FeedbackResult {
  message: string;
  suggestion: string | null;
  references: string[];
}

export default function AssistantPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { questionText: "", correctAnswer: "", userAnswer: "", topic: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: "ad-hoc",
          questionText: values.questionText,
          correctAnswer: values.correctAnswer,
          userAnswer: values.userAnswer,
          topic: values.topic || undefined,
          language: "es",
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as FeedbackResult | null;
      if (!data || !data.message) {
        setResult({
          message:
            "El tutor IA no respondió. Verifica que Ollama esté corriendo localmente.",
          suggestion: null,
          references: [],
        });
        return;
      }
      setResult(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="w-full space-y-5 py-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Feedback IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pregunta al tutor IA por una retroalimentación pedagógica sobre cualquier respuesta.
          La IA explica el concepto clave sin darte la respuesta directa.
        </p>
      </header>

      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border bg-card p-5"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="questionText">Pregunta *</Label>
          <textarea
            id="questionText"
            rows={2}
            className="control w-full"
            placeholder="Ej. ¿Cuál es la capital de Australia?"
            {...register("questionText")}
          />
          {errors.questionText && (
            <p className="text-xs text-destructive">{errors.questionText.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="correctAnswer">Respuesta correcta *</Label>
            <Input
              id="correctAnswer"
              placeholder="Ej. Canberra"
              {...register("correctAnswer")}
            />
            {errors.correctAnswer && (
              <p className="text-xs text-destructive">{errors.correctAnswer.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="userAnswer">Respuesta *</Label>
            <Input
              id="userAnswer"
              placeholder="Ej. Sídney"
              {...register("userAnswer")}
            />
            {errors.userAnswer && (
              <p className="text-xs text-destructive">{errors.userAnswer.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="topic">Tema (opcional)</Label>
          <Input id="topic" placeholder="Ej. geografía" {...register("topic")} />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setResult(null);
              setErrorMsg(null);
            }}
            disabled={loading}
          >
            Limpiar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Generando..." : "Pedir feedback"}
          </Button>
        </div>
      </form>

      {result && (
        <section
          aria-label="Respuesta del tutor IA"
          aria-live="polite"
          className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3"
        >
          <h2 className="text-lg font-bold tracking-tight">Tutor IA</h2>
          <p className="text-sm text-foreground whitespace-pre-line">{result.message}</p>

          {result.suggestion && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sugerencia
              </p>
              <p className="text-sm">{result.suggestion}</p>
            </div>
          )}

          {result.references.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Referencias
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                {result.references.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <aside className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">¿Cómo funciona?</p>
        <p>
          El tutor IA combina recuperación de contexto educativo (RAG) con un modelo de
          lenguaje local (Ollama) para generar retroalimentación corta, motivadora y sin
          revelar la respuesta directa. Si el modelo no responde, la página mostrará un
          mensaje de aviso.
        </p>
      </aside>
    </div>
  );
}
