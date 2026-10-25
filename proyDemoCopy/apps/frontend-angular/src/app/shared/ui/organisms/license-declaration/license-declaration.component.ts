import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
// [LicenseDeclarationComponent · Organismo · Sprints 9.9/9.13 · RF-116/RF-128]: tipo de licencia, fuente, titular, variante Creative Commons y confirmación de derechos (canciones y diálogos) | [Patrón]: Atomic Design (organismo) + Two-way binding (`model`) + Specification (licenseProblem, espejo de NestJS) | [Principio]: DRY (Music y Dialogues) + cumplimiento de derechos de autor | [Paradigma]: Declarativo + Reactivo
// [A11y]: fieldset + legend, etiquetas visibles, error en texto con role="alert" · el botón de guardar del contenedor se desactiva mientras haya `problem`

export type LicenseType = 'public_domain' | 'creative_commons' | 'own_work' | 'permission';
export interface LicenseValue {
  type: LicenseType;
  source: string;
  holder: string;
  variant?: string | null;
  confirmed: boolean;
}
export interface LicenseLabels {
  legend: string;
  type: string;
  types: Record<LicenseType, string>;
  source: string;
  holder: string;
  variant: string;
  confirm: string;
  hint: string; // «No se admiten canciones con derechos reservados sin permiso»
  problems: { holder: string; source: string; variant: string; confirm: string };
}

export const EMPTY_LICENSE: LicenseValue = {
  type: 'own_work',
  source: '',
  holder: '',
  variant: '',
  confirmed: false,
};

// [licenseProblem]: misma regla que NestJS (music/domain/value-objects/license.vo.ts) → la UI avisa antes de enviar | Función pura
export function licenseProblem(l: LicenseValue): keyof LicenseLabels['problems'] | null {
  if (!l.holder.trim()) return 'holder';
  if (l.type !== 'own_work' && !l.source.trim()) return 'source';
  if (l.type === 'creative_commons' && !l.variant?.trim()) return 'variant';
  if (!l.confirmed) return 'confirm';
  return null;
}

// [Titulares conocidos · 2026-10-19]: dominio de la fuente → titular por defecto (editable) | [Patrón]: Lookup Table | sin coincidencia → nombre del dominio
const KNOWN_HOLDERS: Readonly<Record<string, string>> = {
  'wikisource.org': 'Wikisource',
  'wikipedia.org': 'Wikipedia',
  'wikimedia.org': 'Wikimedia Commons',
  'gutenberg.org': 'Project Gutenberg',
  'archive.org': 'Internet Archive',
  'librivox.org': 'LibriVox',
  'mutopiaproject.org': 'Mutopia Project',
  'imslp.org': 'IMSLP',
  'musopen.org': 'Musopen',
  'freesound.org': 'Freesound',
  'ccmixter.org': 'ccMixter',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
};

// [holderFromUrl]: «https://es.wikisource.org/wiki/…» → «Wikisource» · «https://www.cancionesinfantiles.com/x» → «Cancionesinfantiles» | null si no es URL | Función pura
export function holderFromUrl(source: string): string | null {
  let host: string;
  try {
    host = new URL(source.trim()).hostname.replace(/^www\./, ''); // `URL` (WHATWG): valida y separa el dominio
  } catch {
    return null; // Referencia en texto (p. ej. «Libro X, p. 12») → no se adivina nada
  }
  const known = Object.keys(KNOWN_HOLDERS).find((d) => host === d || host.endsWith('.' + d));
  if (known) return KNOWN_HOLDERS[known]!;
  const name = host.split('.').slice(-2, -1)[0] ?? host; // Dominio de segundo nivel
  return name.charAt(0).toUpperCase() + name.slice(1);
}

@Component({
  selector: 'aula-license-declaration',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <fieldset class="space-y-3 rounded-xl border border-border p-4">
      <legend class="px-1 text-sm font-bold">{{ lb.legend }}</legend>
      <p class="text-xs text-muted-foreground">{{ lb.hint }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-semibold text-muted-foreground">
          {{ lb.type }}
          <select
            class="control mt-1 w-full"
            [value]="value().type"
            (change)="patch({ type: $any($event.target).value })"
          >
            @for (t of types; track t) {
              <option [value]="t">{{ lb.types[t] }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ lb.holder }} <span class="req" aria-hidden="true">*</span>
          <input
            required
            class="control mt-1 w-full"
            maxlength="160"
            [value]="value().holder"
            (input)="patch({ holder: $any($event.target).value })"
          />
        </label>
        @if (value().type !== 'own_work') {
          <label class="text-xs font-semibold text-muted-foreground">
            {{ lb.source }} <span class="req" aria-hidden="true">*</span>
            <input
              required
              type="text"
              inputmode="url"
              placeholder="https://…"
              class="control mt-1 w-full"
              maxlength="300"
              [value]="value().source"
              (input)="patch({ source: $any($event.target).value })"
            />
          </label>
        }
        @if (value().type === 'creative_commons') {
          <label class="text-xs font-semibold text-muted-foreground">
            {{ lb.variant }}
            <input
              class="control mt-1 w-full"
              maxlength="40"
              placeholder="CC BY 4.0"
              [value]="value().variant ?? ''"
              (input)="patch({ variant: $any($event.target).value })"
            />
          </label>
        }
      </div>
      <label class="flex min-h-11 items-start gap-2 text-sm">
        <input
          type="checkbox"
          class="mt-0.5 size-4 accent-violet-600"
          [checked]="value().confirmed"
          (change)="patch({ confirmed: $any($event.target).checked })"
        />
        <span>{{ lb.confirm }}</span>
      </label>
      @if (problem(); as p) {
        <p role="alert" class="text-xs font-semibold text-tone-warning"><aula-icon name="triangle-alert" /> {{ lb.problems[p] }}</p>
      }
    </fieldset>
  `,
})
export class LicenseDeclarationComponent {
  readonly value = model<LicenseValue>({ ...EMPTY_LICENSE }); // `model` (Angular 17.2+): [(value)] de ida y vuelta
  readonly labels = input.required<LicenseLabels>();
  protected readonly types: LicenseType[] = [
    'own_work',
    'public_domain',
    'creative_commons',
    'permission',
  ];
  protected readonly problem = computed(() => licenseProblem(this.value()));

  private autoHolder = ''; // Último titular propuesto desde la URL (si el usuario lo cambió, ya no se pisa)

  protected patch(p: Partial<LicenseValue>): void {
    this.value.update((v) => {
      const next = { ...v, ...p };
      // [Autocompletar · 2026-10-19]: al escribir la URL de la fuente se propone el titular según el dominio; el campo sigue editable
      if (p.source !== undefined && (!v.holder.trim() || v.holder === this.autoHolder)) {
        const guess = holderFromUrl(p.source);
        if (guess) next.holder = this.autoHolder = guess;
      }
      return next;
    });
  }
}
