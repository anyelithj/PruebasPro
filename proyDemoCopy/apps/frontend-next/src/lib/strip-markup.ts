// [stripMarkup · 2026-11-11]: quita etiquetas que dejó la IA en preguntas ya guardadas («<text>¿…?</text>») — SOLO al mostrar (el valor enviado sigue siendo el original)
// Misma regla que el backend (generate-ai-questions.use-case: las nuevas ya se guardan limpias) | Función pura
export const stripMarkup = (s: string): string => s.replace(/<\/?[a-z][\w-]*(?:\s[^<>]*)?\/?>/gi, " ").replace(/\s+/g, " ").trim();
