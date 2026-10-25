// review.model.ts => análisis de sentimiento (puerto + adaptador léxico) y reglas de moderación automática.
// El puerto SentimentAnalyzer permite reemplazar el análisis léxico local por el modelo NLP de FastAPI (BERT)
// sin tocar el service (DIP / Ports & Adapters). Funciones puras => testeables sin infraestructura.
import type { ReviewStatus } from "@prisma/client";

export interface SentimentAnalyzer {
  score(text: string): number; // -1 (muy negativo) .. 1 (muy positivo)
  analyze(text: string): SentimentAnalysis; // RF-15.10 etiqueta + puntaje continuo + emociones
}

// Emotion / SentimentAnalysis => RF-15.10 polaridad (POSITIVE, NEUTRAL, NEGATIVE o MIXED), puntaje -1..1 y emociones 0..1
export type Emotion = "happiness" | "frustration" | "surprise" | "disappointment";
export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
export interface SentimentAnalysis {
  score: number;
  label: SentimentLabel;
  emotions: Record<Emotion, number>;
}

// EMOTION_LEXICON => palabras (sin tildes) que evidencian cada emoción (es/en). Léxico corto e ilustrativo: el puerto
// permite reemplazarlo por un modelo (FastAPI) sin tocar el service
const EMOTION_LEXICON: Record<Emotion, readonly string[]> = {
  happiness: ["feliz", "encanta", "encanto", "excelente", "perfecto", "genial", "contento", "contenta", "maravilloso", "love", "happy", "amazing", "great"],
  frustration: ["frustrado", "frustrada", "frustrante", "molesto", "molesta", "enojado", "enojada", "nunca", "tarde", "demora", "pesimo", "horrible", "angry", "annoying", "late"],
  surprise: ["sorpresa", "sorprendido", "sorprendida", "inesperado", "increible", "wow", "superó", "supero", "surprised", "unexpected"],
  disappointment: ["decepcion", "decepcionado", "decepcionada", "esperaba", "lastima", "malo", "mala", "regular", "disappointed", "expected", "meh"],
};
const MIXED_THRESHOLD = 0.3; // Ambas polaridades presentes con peso => "mixto"

// Léxico mínimo español/inglés (palabra -> peso). Las negaciones invierten la palabra siguiente ("no me gusta")
const LEXICON: Record<string, number> = {
  excelente: 1, perfecto: 1, encanta: 1, genial: 0.8, bueno: 0.6, buena: 0.6, recomendado: 0.8, recomiendo: 0.8,
  rapido: 0.4, calidad: 0.3, comodo: 0.5, hermoso: 0.7, feliz: 0.7, gusta: 0.6, great: 0.8, good: 0.6, love: 1,
  malo: -0.7, mala: -0.7, pesimo: -1, horrible: -1, terrible: -1, defectuoso: -0.9, roto: -0.8, tarde: -0.4,
  estafa: -1, devolver: -0.4, decepcion: -0.8, falso: -0.9, bad: -0.7, awful: -1, broken: -0.8, worst: -1,
};
const NEGATIONS = new Set(["no", "nunca", "jamas", "tampoco", "not", "never"]);
const NEGATION_WINDOW = 2; // Cuántas palabras hacia atrás puede estar la negación

// normalize => minúsculas sin tildes, solo letras y espacios
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-zñ\s]/g, " ");

export class LexiconSentimentAnalyzer implements SentimentAnalyzer {
  // analyze => RF-15.10 puntaje (promedio léxico), etiqueta (mixto si hay positivas y negativas fuertes) y emociones
  // (proporción de palabras de cada emoción, normalizada a 0..1)
  public analyze(text: string): SentimentAnalysis {
    const words = normalize(text).split(/\s+/).filter(Boolean);
    const score = this.score(text);
    const positive = words.filter((word) => (LEXICON[word] ?? 0) > 0).length;
    const negative = words.filter((word) => (LEXICON[word] ?? 0) < 0).length;
    const hits = positive + negative;
    const mixed = hits > 1 && Math.min(positive, negative) / hits >= MIXED_THRESHOLD;
    const label: SentimentLabel = mixed ? "MIXED" : score > 0.15 ? "POSITIVE" : score < -0.15 ? "NEGATIVE" : "NEUTRAL";
    const counts = Object.fromEntries((Object.keys(EMOTION_LEXICON) as Emotion[]).map((emotion) => [emotion, words.filter((word) => EMOTION_LEXICON[emotion].includes(word)).length])) as Record<Emotion, number>;
    const max = Math.max(1, ...Object.values(counts));
    const emotions = Object.fromEntries(Object.entries(counts).map(([emotion, count]) => [emotion, Number((count / max).toFixed(2))])) as Record<Emotion, number>;
    return { score, label, emotions };
  }

  public score(text: string): number {
    const words = normalize(text).split(/\s+/).filter(Boolean);
    let total = 0;
    let hits = 0;
    // "forEach((word, i))" => el índice permite mirar las palabras anteriores (negación)
    words.forEach((word, index) => {
      const weight = LEXICON[word];
      if (weight === undefined) return;
      // Ventana de 2 palabras: "no me gusta" y "no es bueno" también quedan negadas (no solo "no gusta")
      const negated = words.slice(Math.max(0, index - NEGATION_WINDOW), index).some((previous) => NEGATIONS.has(previous));
      total += negated ? -weight : weight;
      hits += 1;
    });
    // Promedio acotado a [-1, 1]; sin palabras del léxico => neutral (0)
    return hits === 0 ? 0 : Math.max(-1, Math.min(1, Number((total / hits).toFixed(3))));
  }
}

// Señales de spam/contenido no permitido en una reseña pública
const LINK_PATTERN = /(https?:\/\/|www\.)\S+/i;
const CONTACT_PATTERN = /[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s-]{8,}/; // Emails o teléfonos (evita desviar ventas fuera de la plataforma)
const BLOCKED_WORDS = ["idiota", "estupido", "imbecil", "mierda"]; // Lista corta ilustrativa (en producción: diccionario administrable)

// moderate => decide el estado inicial: APPROVED (publicada), PENDING (revisión humana)
export function moderate(text: string, sentiment: number): { status: ReviewStatus; note: string | null } {
  const normalized = normalize(text);
  if (LINK_PATTERN.test(text)) return { status: "PENDING", note: "Contiene enlaces" };
  if (CONTACT_PATTERN.test(text)) return { status: "PENDING", note: "Contiene datos de contacto" };
  if (BLOCKED_WORDS.some((word) => normalized.includes(word))) return { status: "PENDING", note: "Lenguaje ofensivo" };
  // Las reseñas MUY negativas se revisan (no para ocultarlas, sino para que soporte actúe rápido)
  if (sentiment <= -0.8) return { status: "PENDING", note: "Sentimiento muy negativo: revisión de soporte" };
  return { status: "APPROVED", note: null };
}

export const EDIT_WINDOW_DAYS = 30;
export const REVIEW_REQUEST_DELAY_DAYS = 3; // RF-15.8 se pide la reseña 3 días después de la entrega (ya se probó el producto)

// ASPECT_KEYS => RF-15.2 aspectos calificables de 1 a 5
export const ASPECT_KEYS = ["quality", "accuracy", "fit", "value"] as const;
export type Aspects = Partial<Record<(typeof ASPECT_KEYS)[number], number>>;
