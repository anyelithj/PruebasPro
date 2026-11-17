// [Historias · SocialLinks]: iconos-enlace a las redes del docente | [Patrón]: CSF 3 + Lookup Table (icono por red) | [Principio]: SRP + OCP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SocialLinks } from "./SocialLinks";

const meta = {
  title: "Shared/SocialLinks",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Iconos-enlace a las redes del docente.\n\n**Patrón:** CSF 3 + Lookup Table (icono por red) · **Principio:** SRP + OCP · **Paradigma:** Declarativo" } } },
  component: SocialLinks,
  // [links]: URLs https de los dominios permitidos (isSocialUrl) · YouTube sin configurar
  args: {
    owner: "Ana Pérez",
    links: { linkedin: "https://www.linkedin.com/in/ana-perez", twitter: "https://x.com/anaperez", spotify: "https://open.spotify.com/show/abc", youtube: null },
  },
} satisfies Meta<typeof SocialLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Solo configuradas]: YouTube no aparece
export const Default: Story = {};
// [showEmpty]: vista de estudiante → la red sin configurar se ve atenuada y sin enlace (role="img")
export const ShowEmpty: Story = { args: { showEmpty: true } };
// [emptyHref]: vista de quien gestiona el curso → el icono vacío lleva a completar el perfil
export const ShowEmptyEditable: Story = { args: { showEmpty: true, emptyHref: "/profile" } };
// [Color del curso]: variable CSS `--social-hover` en el hover
export const CourseColor: Story = { args: { color: "#7c3aed" } };
