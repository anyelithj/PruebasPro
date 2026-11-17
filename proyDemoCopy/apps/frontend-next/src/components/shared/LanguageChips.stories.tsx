// [Historias · LanguageChips]: pestañas de idioma como enlaces (URL State) | [Patrón]: CSF 3 + Atomic Design (molecule) + Strategy (hrefFor) | [Principio]: DRY + SSOT (LANGUAGES) | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LanguageChips } from "./LanguageChips";

const meta = {
  title: "Shared/LanguageChips",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Pestañas de idioma como enlaces (URL State).\n\n**Patrón:** CSF 3 + Atomic Design (molecule) + Strategy (hrefFor) · **Principio:** DRY + SSOT (LANGUAGES) · **Paradigma:** Declarativo" } } },
  component: LanguageChips,
  // [hrefFor]: cada página construye su URL; aquí la del catálogo de cursos | `?:` (JS): sin idioma = «Todos»
  args: { hrefFor: (language?: string) => (language ? `/courses?language=${language}` : "/courses") },
} satisfies Meta<typeof LanguageChips>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Todos]: sin `active` → chip «Todos» con aria-current="page"
export const AllActive: Story = {};
// [Francés]: el código se acepta en minúscula o mayúscula
export const FrenchActive: Story = { args: { active: "fr" } };
// [Traducido]: `names` (dict.languageNames) sustituye las etiquetas del SSOT
export const Translated: Story = { args: { active: "en", allLabel: "All", label: "Languages", names: { EN: "English", FR: "French", DE: "German" } } };
