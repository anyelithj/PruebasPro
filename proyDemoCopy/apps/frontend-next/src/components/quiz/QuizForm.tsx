"use client";
import { Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useRef, useState } from "react";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos del modal de resultado
import { ResultDialog, type SaveResult } from "@/components/shared/ResultDialog"; // [Modal de resultado]: éxito / error al guardar
import { fmt } from "@aula/shared-i18n";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_VALUES } from "@/lib/categories";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_VALUES, languageLabel } from "@/lib/languages";
import type {
  AIProvider,
  Category,
  CreateQuizInput,
  Difficulty,
  Language,
  QuestionType,
  Quiz,
} from "@/types/quiz";
// [QuizForm]: formulario ÚNICO de alta y edición de examen (con `initial` edita vía PATCH, sin él crea vía POST) | form RHF + Zod | selector de idioma objetivo (explicaciones en español) | sin publicar por defecto | panel preguntas oculto hasta primera pregunta creada/generada | botón "Crear pregunta" + "Generar pregunta con IA" | [Patrón]: Container/Presentational + Composite + Strategy UI | [Principio]: SRP + DRY + DIP | [Paradigma]: Funcional + Reactivo + Declarativo

// [emptyToUndefined]: un <input type=number> vacío llega como "" → `coerce` lo convertía en 0 y fallaba `min(5)` SIN mensaje visible (el examen «no se creaba») | [2026-10-23] | [Paradigma]: Funcional (pura)
const emptyToUndefined = (v: unknown) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v);

// [Schema Zod alineado con backend CreateQuizDto]: validación cliente + tipos exactos | [Patrón]: SSOT
const questionSchema = z
  .object({
    text: z.string().trim().min(1, "El enunciado es obligatorio").max(1000),
    type: z.enum(["multiple_choice", "true_false", "open_answer"]),
    options: z
      .array(z.string().trim().min(1, "Opción vacía"))
      .max(6, "Máximo 6 opciones")
      .optional(),
    correctAnswer: z.string().trim().min(1, "Respuesta correcta obligatoria").max(1000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    timeLimitSeconds: z.preprocess(emptyToUndefined, z.coerce.number().int().min(5, "Mínimo 5 segundos").optional()), // `preprocess` (Zod): normaliza antes de validar
    explanation: z.string().trim().max(2000).optional(),
    feedback: z.string().trim().max(2000).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "multiple_choice") {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Multiple choice requiere al menos 2 opciones",
        });
      } else if (!q.options.includes(q.correctAnswer)) {
        ctx.addIssue({
          code: "custom",
          path: ["correctAnswer"],
          message: "La respuesta correcta debe estar entre las opciones",
        });
      }
    }
    if (q.type === "true_false") {
      const allowed = ["true", "false", "True", "False", "verdadero", "falso"];
      if (!allowed.includes(q.correctAnswer.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          path: ["correctAnswer"],
          message: "Para true/false la respuesta debe ser 'true' o 'false'",
        });
      }
    }
  });

const createQuizSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(160),
  description: z.string().trim().max(2000).optional(),
  language: z.enum(LANGUAGE_VALUES),
  category: z.enum(CATEGORY_VALUES),
  difficulty: z.enum(["easy", "medium", "hard"]),
  timePerQuestionSeconds: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(600, "Máximo 600 segundos").optional()),
  isPublished: z.boolean().optional(),
  questions: z.array(questionSchema).min(1, "Agrega al menos una pregunta"),
});

type CreateQuizForm = z.input<typeof createQuizSchema>;

// [Datos iniciales en edición]: `id` + valores del formulario (preguntas con correctAnswer) | [Principio]: SSOT con el esquema
export type QuizFormInitial = { id: string } & CreateQuizForm;

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: "multiple_choice", label: "Opción múltiple" },
  { value: "true_false", label: "Verdadero / Falso" },
  { value: "open_answer", label: "Respuesta abierta" },
];

const AI_PROVIDERS: Array<{ value: AIProvider; label: string }> = [
  { value: "aya", label: "Aya Expanse 8B (recomendado)" },
  { value: "qwen", label: "Qwen3 8B" },
  { value: "mistral", label: "Mistral Nemo" },
];

const AI_BATCH = 3; // Preguntas por llamada al LLM local (≈1 min en CPU)

const selectClass =
  "control w-full";

// [Respuesta backend AI]: SSOT con GenerateAIQuestionsResult | [Principio]: SSOT
interface AIGeneratedQuestion {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  category: Category;
  language: Language;
  explanation: string;
  feedback: string;
  provider: string;
}

interface AIGenerateResponse {
  questions: AIGeneratedQuestion[];
  usedProvider: string;
  fallbackUsed: boolean;
}

export function QuizForm({ initial }: { initial?: QuizFormInitial }) {
  const isEdit = Boolean(initial); // Modo edición → PATCH y panel de preguntas abierto
  const router = useRouter();
  const { t } = usePreferences();
  const [result, setResult] = useState<SaveResult | null>(null); // [Diálogo de resultado]: null = cerrado
  const savedHref = useRef<string | null>(null); // Detalle del examen guardado → destino al cerrar el modal de éxito
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // [Estado UI panel preguntas]: oculto por defecto, se muestra al crear/generar primera pregunta | [Patrón]: Progressive Disclosure
  const [questionsPanelOpen, setQuestionsPanelOpen] = useState(isEdit);

  // [Estado UI generador IA]: panel inline contraíble con su propio loading/error | [Patrón]: Local State
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  // [Cantidad como string]: permite vaciar el campo al editar; se valida/clampa al generar | [Patrón]: Controlled Raw Input
  const [aiAmount, setAiAmount] = useState("5");
  // [Tipo de pregunta a generar]: opción múltiple, verdadero/falso o respuesta abierta | [Patrón]: Strategy hint
  const [aiType, setAiType] = useState<QuestionType>("multiple_choice");
  const [aiProvider, setAiProvider] = useState<AIProvider>("aya");
  const [aiRunning, setAiRunning] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateQuizForm>({
    resolver: zodResolver(createQuizSchema),
    // [Edición]: valores del examen; [Alta]: valores por defecto | `??` (ES2020)
    defaultValues: initial ?? {
      title: "",
      description: "",
      language: DEFAULT_LANGUAGE,
      category: "general",
      difficulty: "medium",
      timePerQuestionSeconds: 30,
      // [Sin publicar por defecto]: el docente revisa antes de publicar | [Patrón]: Safe Default
      isPublished: false,
      // [Inicialmente sin preguntas]: el panel está oculto hasta primera acción | [Patrón]: Progressive Disclosure
      questions: [],
    } as unknown as CreateQuizForm,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "questions" });
  const watchedQuestions = watch("questions");

  // [Crea pregunta manual vacía]: hidrata defaults sensatos + hereda tiempo global del examen y abre panel | [Principio]: DRY
  const addManualQuestion = () => {
    const globalTime = Number(getValues("timePerQuestionSeconds")) || undefined;
    append({
      text: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      difficulty: getValues("difficulty") ?? "medium",
      // [Hereda tiempo del examen]: el docente puede sobreescribirlo por pregunta | [Patrón]: Default Inheritance
      timeLimitSeconds: globalTime,
    });
    setQuestionsPanelOpen(true);
  };

  // [Abrir panel IA con Tema autogenerado]: al abrir, si Tema está vacío se prefilla con el título; si no hay título, con la categoría | [Patrón]: Smart Default | [Principio]: DRY
  const openAiPanel = () => {
    setAiPanelOpen((open) => {
      const next = !open;
      if (next && !aiTopic.trim()) {
        const title = (getValues("title") ?? "").trim();
        const categoryLabel =
          CATEGORIES.find((c) => c.value === getValues("category"))?.label ?? "";
        const suggested = title || categoryLabel;
        if (suggested) setAiTopic(suggested);
      }
      return next;
    });
  };

  // [Generar preguntas con IA]: llama a /api/quiz/ai/generate y agrega al field array | [Patrón]: Command + Adapter | [Principio]: SRP
  const generateAiQuestions = async () => {
    setAiError(null);
    setAiNotice(null);
    if (!aiTopic.trim()) {
      setAiError("Indica un tema para generar las preguntas.");
      return;
    }
    // [Clamp cantidad]: el campo puede estar vacío o fuera de rango; se normaliza a [1,20] | [Patrón]: Input Sanitization
    const amount = Math.max(1, Math.min(20, Number(aiAmount) || 1));
    setAiRunning(true);
    let made = 0; // `let`: preguntas ya añadidas (sobrevive a un lote fallido → éxito parcial)
    try {
      // [Lotes de AI_BATCH · 2026-10-23]: 10 preguntas en una sola llamada tardaban 4–6 min en CPU y superaban el timeout del BFF; por lotes, cada una llega antes y el docente ve el avance | [Patrón]: Batching + Progressive Rendering
      while (made < amount) {
        const batch = Math.min(AI_BATCH, amount - made);
        setAiNotice(`Generando preguntas ${made + 1}–${made + batch} de ${amount}…`);
        const res = await fetch("/api/quiz/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: aiTopic.trim(),
            amount: batch,
            type: aiType,
            language: getValues("language"),
            category: getValues("category"),
            difficulty: getValues("difficulty"),
            provider: aiProvider,
          }),
        });
        const body = (await res.json()) as AIGenerateResponse | { message?: string };
        if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
        const data = body as AIGenerateResponse;
        if (!data.questions?.length) throw new Error("La IA no devolvió preguntas válidas.");
        appendAi(data.questions);
        made += data.questions.length;
        setQuestionsPanelOpen(true);
        if (data.questions.length < batch) break; // [Stagnation Guard]: el modelo ya no aporta más
      }
      setAiNotice(`Se ${made === 1 ? "generó" : "generaron"} ${made} pregunta${made === 1 ? "" : "s"} correctamente.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Error generando preguntas";
      setAiNotice(made ? `Se añadieron ${made} de ${amount} preguntas.` : null);
      setAiError(reason);
    } finally {
      setAiRunning(false);
    }
  };

  // [appendAi]: preguntas IA → field array heredando el tiempo del examen | [Principio]: SRP
  const appendAi = (questions: AIGeneratedQuestion[]) => {
      const globalTime = Number(getValues("timePerQuestionSeconds")) || undefined;
      for (const q of questions) {
        append({
          text: q.text,
          type: q.type,
          options: q.type === "multiple_choice" ? q.options : undefined,
          correctAnswer: q.correctAnswer,
          difficulty: q.difficulty,
          // [Hereda tiempo del examen]: editable por pregunta | [Patrón]: Default Inheritance
          timeLimitSeconds: globalTime,
          explanation: q.explanation,
          feedback: q.feedback,
        });
      }
  };

  // [onInvalid · 2026-10-23]: si algo no valida, se dice QUÉ y DÓNDE (antes el clic en «Crear examen» no hacía nada visible) | [Patrón]: Error Summary (WCAG 3.3.1)
  const onInvalid = (errs: typeof errors) => {
    const list: string[] = [];
    if (errs.title?.message) list.push(`Título: ${errs.title.message}`);
    if (errs.timePerQuestionSeconds?.message) list.push(`Tiempo por pregunta: ${errs.timePerQuestionSeconds.message}`);
    if (typeof errs.questions?.message === "string") list.push(errs.questions.message);
    // `forEach` con índice: primer mensaje de cada pregunta con error | `Object.values` (ES2017)
    (Array.isArray(errs.questions) ? errs.questions : []).forEach((q, i) => {
      const first = q && Object.values(q).find((e) => e && typeof e === "object" && "message" in e) as { message?: string } | undefined;
      if (first?.message) list.push(`Pregunta ${i + 1}: ${first.message}`);
    });
    const reason = list.join(" · ") || "Revisa los campos marcados.";
    setSubmitError(reason);
    setResult({ ok: false, message: fmt(t.common.result.examError, { reason }) });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      // [Parsed]: Zod `coerce.number()` produce number en output pero RHF infiere z.input | [Patrón]: Output Cast | [Principio]: SSOT
      const parsed = createQuizSchema.parse(values);
      const payload: CreateQuizInput = {
        title: parsed.title,
        description: parsed.description || undefined,
        category: parsed.category,
        difficulty: parsed.difficulty,
        language: parsed.language,
        timePerQuestionSeconds: parsed.timePerQuestionSeconds,
        isPublished: parsed.isPublished,
        questions: parsed.questions.map((q) => ({
          text: q.text,
          type: q.type,
          options: q.type === "multiple_choice" ? q.options : undefined,
          correctAnswer: q.correctAnswer,
          difficulty: q.difficulty,
          timeLimitSeconds: q.timeLimitSeconds,
          explanation: q.explanation,
          feedback: q.feedback,
        })),
      };
      // [Strategy]: POST crea · PATCH reemplaza metadatos y preguntas del examen existente
      const res = await fetch(isEdit ? `/api/quiz/${initial!.id}` : "/api/quiz", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as Quiz;
      // [Éxito]: modal de confirmación; al cerrarlo se abre el detalle del examen (onCloseResult)
      savedHref.current = `/quiz/${saved.id ?? initial?.id}`;
      setResult({ ok: true, message: fmt(t.common.result[isEdit ? "examUpdated" : "examCreated"], { title: parsed.title }) });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Error al guardar el examen";
      setSubmitError(reason);
      setResult({ ok: false, message: fmt(t.common.result.examError, { reason }) }); // [Error]: modal + aviso en línea
    } finally {
      setIsSubmitting(false);
    }
  }, onInvalid);

  const showQuestionsPanel = questionsPanelOpen || fields.length > 0;

  return (
    <div>
      {submitError && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}

      {/* [Cerrar modal]: éxito → detalle del examen; error → se queda para corregir */}
      <ResultDialog
        result={result}
        onClose={() => {
          const href = result?.ok ? savedHref.current : null;
          setResult(null);
          if (href) {
            router.push(href);
            router.refresh(); // El detalle muestra los cambios recién guardados
          }
        }}
      />
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* [Sección metadatos del quiz] */}
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" autoComplete="off" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              rows={3}
              className="control w-full"
              {...register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="language">Idioma objetivo *</Label>
              <select id="language" className={selectClass} {...register("language")}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Competencia *</Label>
              <select id="category" className={selectClass} {...register("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Nivel MCER *</Label>
              <select id="difficulty" className={selectClass} {...register("difficulty")}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="timePerQuestionSeconds">Tiempo por pregunta (s)</Label>
              <Input
                id="timePerQuestionSeconds"
                type="number"
                min={0}
                {...register("timePerQuestionSeconds")}
              />
              {errors.timePerQuestionSeconds && <p className="text-xs text-destructive">{errors.timePerQuestionSeconds.message}</p>}
            </div>
            <div className="flex items-end gap-2">
              <input
                id="isPublished"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...register("isPublished")}
              />
              <Label htmlFor="isPublished" className="cursor-pointer">
                Publicar inmediatamente
              </Label>
            </div>
          </div>
        </section>

        {/* [Acciones para crear/generar preguntas] | [Patrón]: Command Cluster */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Preguntas</h2>
              <p className="text-xs text-muted-foreground">
                {fields.length === 0
                  ? "Aún no hay preguntas. Crea una manualmente o genera varias con IA."
                  : `${fields.length} pregunta${fields.length === 1 ? "" : "s"} agregada${fields.length === 1 ? "" : "s"}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={addManualQuestion} variant="secondary">
                + Crear pregunta
              </Button>
              <Button
                type="button"
                onClick={openAiPanel}
                className="bg-gradient-brand text-white"
              >
                {aiPanelOpen ? "Cerrar IA" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Generar pregunta con IA</>}
              </Button>
            </div>
          </div>

          {/* [Panel generador IA inline] */}
          {aiPanelOpen && (
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="aiTopic">Tema</Label>
                  <Input
                    id="aiTopic"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="Ej. Presente simple, Vocabulario de viajes, Pedir en un restaurante"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aiAmount">Cantidad</Label>
                  <Input
                    id="aiAmount"
                    type="number"
                    min={1}
                    max={20}
                    value={aiAmount}
                    onChange={(e) => setAiAmount(e.target.value)}
                    onBlur={(e) =>
                      setAiAmount(
                        String(Math.max(1, Math.min(20, Number(e.target.value) || 1))),
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aiType">Tipo de pregunta</Label>
                  <select
                    id="aiType"
                    className={selectClass}
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value as QuestionType)}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aiProvider">Motor</Label>
                  <select
                    id="aiProvider"
                    className={selectClass}
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Las preguntas se generan en {languageLabel(watch("language"))} según la competencia y el nivel del examen; la explicación y el feedback, en español. Revisa el contenido generado antes de publicar.
              </p>
              {aiError && (
                <p role="alert" className="text-xs text-destructive">
                  {aiError}
                </p>
              )}
              {aiNotice && (
                <p role="status" className="text-xs text-tone-brand">
                  {aiNotice}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={generateAiQuestions} disabled={aiRunning}>
                  {aiRunning ? "Generando..." : "Generar y añadir"}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* [Lista de preguntas — oculta hasta tener al menos una] | [Patrón]: Progressive Disclosure */}
        {showQuestionsPanel && fields.length > 0 && (
          <section className="space-y-4">
            {errors.questions && typeof errors.questions.message === "string" && (
              <p className="text-xs text-destructive">{errors.questions.message}</p>
            )}

            {fields.map((field, idx) => {
              const currentType = watchedQuestions?.[idx]?.type ?? "multiple_choice";
              return (
                <article
                  key={field.id}
                  className="space-y-3 rounded-lg border bg-card p-5"
                  aria-label={`Pregunta ${idx + 1}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Pregunta #{idx + 1}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => remove(idx)}
                      aria-label={`Eliminar pregunta ${idx + 1}`}
                    >
                      Eliminar
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`q-${idx}-text`}>Enunciado *</Label>
                    <Input
                      id={`q-${idx}-text`}
                      {...register(`questions.${idx}.text` as const)}
                    />
                    {errors.questions?.[idx]?.text && (
                      <p className="text-xs text-destructive">
                        {errors.questions[idx]?.text?.message}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${idx}-type`}>Tipo *</Label>
                      <select
                        id={`q-${idx}-type`}
                        className={selectClass}
                        {...register(`questions.${idx}.type` as const, {
                          onChange: (e) => {
                            if (e.target.value !== "multiple_choice") {
                              setValue(`questions.${idx}.options`, undefined);
                            } else {
                              setValue(`questions.${idx}.options`, ["", "", "", ""]);
                            }
                            setValue(`questions.${idx}.correctAnswer`, "");
                          },
                        })}
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${idx}-difficulty`}>Nivel MCER *</Label>
                      <select
                        id={`q-${idx}-difficulty`}
                        className={selectClass}
                        {...register(`questions.${idx}.difficulty` as const)}
                      >
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentType === "multiple_choice" && (
                    <div className="space-y-2">
                      <Label>Opciones *</Label>
                      {[0, 1, 2, 3].map((optIdx) => (
                        <Input
                          key={optIdx}
                          placeholder={`Opción ${optIdx + 1}`}
                          {...register(`questions.${idx}.options.${optIdx}` as const)}
                        />
                      ))}
                      {errors.questions?.[idx]?.options && (
                        <p className="text-xs text-destructive">
                          {errors.questions[idx]?.options?.message as string}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor={`q-${idx}-correctAnswer`}>
                      Respuesta correcta *{" "}
                      {currentType === "true_false" && (
                        <span className="text-xs text-muted-foreground">(true / false)</span>
                      )}
                    </Label>
                    <Input
                      id={`q-${idx}-correctAnswer`}
                      {...register(`questions.${idx}.correctAnswer` as const)}
                    />
                    {errors.questions?.[idx]?.correctAnswer && (
                      <p className="text-xs text-destructive">
                        {errors.questions[idx]?.correctAnswer?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`q-${idx}-timeLimit`}>
                      Tiempo límite (s, opcional)
                    </Label>
                    <Input
                      id={`q-${idx}-timeLimit`}
                      type="number"
                      min={5}
                      {...register(`questions.${idx}.timeLimitSeconds` as const)}
                    />
                    {errors.questions?.[idx]?.timeLimitSeconds && (
                      <p className="text-xs text-destructive">{errors.questions[idx]?.timeLimitSeconds?.message}</p>
                    )}
                  </div>

                  {/* [Feedback / explanation editables — venidos de IA o ingreso manual] | [Principio]: SSOT con backend */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${idx}-explanation`}>
                        Explicación (en español)
                      </Label>
                      <textarea
                        id={`q-${idx}-explanation`}
                        rows={2}
                        className="control w-full"
                        {...register(`questions.${idx}.explanation` as const)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${idx}-feedback`}>
                        Feedback pedagógico
                      </Label>
                      <textarea
                        id={`q-${idx}-feedback`}
                        rows={2}
                        className="control w-full"
                        {...register(`questions.${idx}.feedback` as const)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || fields.length === 0}>
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear examen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
