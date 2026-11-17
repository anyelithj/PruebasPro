// [Historias · PublicNavbar]: barra de las páginas públicas (landing, login, registro) | [Patrón]: CSF 3 + Atomic Design (organism) + Composite | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [Tema]: solo admite Claro/Oscuro → con Sepia/Alto contraste/Deep focus en la barra de Storybook se ve en Claro (guardián de tema público, comportamiento real)
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PublicNavbar } from "./PublicNavbar";

const meta = {
  title: "Layout/PublicNavbar",
  component: PublicNavbar,
  // [layout: fullscreen]: la barra ocupa todo el ancho, como en la app | [docs inline=false]: `sticky` + menú móvil → iframe propio
  parameters: {
    layout: "fullscreen",
    docs: {
      description: { component: "Barra de las páginas públicas (landing, login, registro).\n\n**Patrón:** CSF 3 + Atomic Design (organism) + Composite · **Principio:** SRP + DRY · **Paradigma:** Declarativo" },
      story: { inline: false, iframeHeight: 280 },
    },
  },
} satisfies Meta<typeof PublicNavbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Login/registro]: sin anclas de secciones
export const Default: Story = {};
// [Landing]: con las anclas #cursos, #niveles, #como-funciona, #planes y #faq (desde lg)
export const Landing: Story = { args: {} };
// [Móvil]: `viewport` (Storybook): ancho de teléfono → aparece la hamburguesa (aria-expanded + aria-controls)
export const Mobile: Story = { args: {}, globals: { viewport: { value: "mobile1" } } };
