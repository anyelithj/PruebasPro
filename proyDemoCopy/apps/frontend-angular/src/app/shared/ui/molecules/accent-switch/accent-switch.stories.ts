// [Historias · AccentSwitchComponent]: interruptor UK/US (role="switch") que guarda el acento en SpeechSynthesisService | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo (signals)
import type { Meta, StoryObj } from '@storybook/angular';
import { AccentSwitchComponent } from './accent-switch.component';

const meta = {
  title: 'UI/Molecules/AccentSwitch',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Interruptor UK/US (role="switch") que guarda el acento en SpeechSynthesisService.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP · **Paradigma:** Declarativo + Reactivo (signals)' } } },
  component: AccentSwitchComponent, // `inject(SpeechSynthesisService)`: servicio raíz (providedIn: 'root') → funciona sin providers extra
  args: { label: 'Acento británico (UK) o estadounidense (US)' },
} satisfies Meta<AccentSwitchComponent>;

export default meta;
export const Default: StoryObj<AccentSwitchComponent> = {};
