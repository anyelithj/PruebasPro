// [Historias · Markdown]: render mínimo y seguro (sin dangerouslySetInnerHTML) | [Patrón]: CSF 3 + Interpreter (línea → bloque) | [Principio]: KISS + YAGNI | [Paradigma]: Funcional
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Markdown } from "./Markdown";

// [Muestra]: títulos, negrita, viñetas, lista numerada y ejemplos «frase (traducción)» | Template literal (ES2015): texto multilínea
const SAMPLE = `## Present simple
Se usa para **hábitos** y verdades generales.

- I work every day.
- She lives in Madrid.

1. Sujeto
2. Verbo (+s en 3.ª persona)

Ejemplos: Dogs bark. (Los perros ladran.) The sun rises in the east. (El sol sale por el este.)`;

const meta = {
  title: "Shared/Markdown",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Render mínimo y seguro (sin dangerouslySetInnerHTML).\n\n**Patrón:** CSF 3 + Interpreter (línea → bloque) · **Principio:** KISS + YAGNI · **Paradigma:** Funcional" } } },
  component: Markdown,
  args: { text: SAMPLE },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Sin idioma]: todo como texto normal
export const Default: Story = {};
// [lang="en"]: lo escrito en inglés se colorea y cada palabra es pulsable (data-dict-word → WordDictionary)
export const WithCourseLanguage: Story = { args: { lang: "en" } };
