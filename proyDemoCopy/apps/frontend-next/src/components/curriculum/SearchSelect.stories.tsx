// [Historias · SearchSelect · 2026-11-17]: Combo con búsqueda asíncrona y caché por contexto | [Patrón]: CSF 3 + Strategy (fetchOptions) + Debounce | [Principio]: DIP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { SearchSelect } from "./SearchSelect";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/SearchSelect",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Combo con búsqueda asíncrona y caché por contexto\n\n**Patrón:** Strategy (fetchOptions) + Debounce · **Principio:** DIP · **Paradigma:** Reactivo" } } },
  component: SearchSelect,
  args: {
    id: "topic",
    label: "Tema",
    placeholder: "Busca un tema…",
    value: null,
    onSelect: fn(),
    contextKey: "en:A2",
    // `async` (JS): simula la API filtrando una lista local
    fetchOptions: async (q: string) => [{ id: "t1", label: "Familia" }, { id: "t2", label: "Comida" }, { id: "t3", label: "Viajes" }].filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
  },
} satisfies Meta<typeof SearchSelect>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, disabledHint: "Elige antes el idioma" } };
