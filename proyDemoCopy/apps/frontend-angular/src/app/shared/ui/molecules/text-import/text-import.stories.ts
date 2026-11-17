// [Historias · TextImportComponent]: importar texto desde archivo (PDF/Word/imagen) o enlace | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: SRP (la extracción vive en TextImportService) | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test'; // `fn` (Storybook): espía del output `imported` en el panel Actions | [Patrón]: Spy
import { TextImportComponent, type TextImportLabels } from './text-import.component';

const LABELS: TextImportLabels = {
  file: 'Desde un archivo (PDF, Word, texto o imagen)',
  url: 'O desde un enlace',
  read: 'Leer enlace',
  reading: 'Leyendo…',
};

const meta = {
  title: 'UI/Molecules/TextImport',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Importar texto desde archivo (PDF/Word/imagen) o enlace.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP (la extracción vive en TextImportService) · **Paradigma:** Declarativo' } } },
  component: TextImportComponent,
  args: { labels: LABELS, language: 'en', imported: fn() },
} satisfies Meta<TextImportComponent>;

export default meta;
type Story = StoryObj<TextImportComponent>;

export const FileAndUrl: Story = {};
export const FileOnly: Story = { args: { labels: { ...LABELS, url: '' } } }; // `url` vacío → sin campo de enlace
