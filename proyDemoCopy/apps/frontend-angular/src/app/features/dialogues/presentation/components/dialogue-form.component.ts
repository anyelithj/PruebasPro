import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { pickLanguage, pickLevel } from '@core/layout/prefill'; // [2026-10-24]: ?idioma=&nivel= desde Gestión → Crear actividad
import { ModeSwitchComponent } from '@shared/ui/molecules/mode-switch/mode-switch.component';
import {
  EMPTY_LICENSE,
  holderFromUrl,
  LicenseDeclarationComponent,
  licenseProblem,
  type LicenseLabels,
  type LicenseValue,
} from '@shared/ui/organisms/license-declaration/license-declaration.component';
import type { DialogueDraft, DialogueInput, Topic } from '../../domain/models/dialogues';
// [DialogueFormComponent · Presentacional · Sprint 9.13 · RF-125/RF-128]: título, idioma, tema, nombres de los dos hablantes, turnos por hablante y licencia; al guardar NestJS obtiene IPA y traducción y estima el nivel | [Patrón]: Presentational Component + Builder (lista de turnos editable) + Strategy de origen (manual · URL · IA) | [Principio]: SRP + Fail Fast (dos hablantes y licencia válida antes de enviar) | [Paradigma]: Declarativo + Reactivo
// [2026-10-19]: tres formas de crearlo — Manual (escribir), Desde una URL (se lee el guion «Nombre: frase» de la página) y Con IA (diálogo original del tema);
// las dos últimas rellenan los turnos para REVISARLOS antes de guardar · obligatorios con * y borde rojo al intentar guardar
// [A11y]: cada turno con etiqueta (hablante y texto), botones con nombre · el error en texto · estado del borrador con aria-live

export interface DialogueFormLabels {
  dialogueTitle: string;
  topic: string;
  noTopic: string;
  speakers: string;
  speaker: string;
  text: string;
  addTurn: string;
  remove: string;
  save: string;
  minTurns: string;
  mode: string;
  modeManual: string;
  modeManualHint: string;
  modeUrl: string;
  modeUrlHint: string;
  modeAi: string;
  modeAiHint: string;
  url: string;
  readUrl: string;
  aiTopic: string;
  aiTopicPlaceholder: string;
  aiTurns: string;
  generate: string;
  drafting: string;
  draftReady: string;
  aiReview: string;
  level: string;
  required: string;
}

// [Petición de borrador]: lo que el contenedor necesita para pedirlo (modo URL o IA)
export interface DraftAsk {
  mode: 'url' | 'ai';
  url?: string;
  topic?: string;
  language: string;
  level: string;
  turns: number;
  title?: string;
  speakers?: string[];
}

// [tokens]: palabras de 3+ letras sin tildes ni mayúsculas (para relacionar el título con los temas) | `Intl`-free, función pura
const tokens = (text: string): Set<string> =>
  new Set(
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3),
  );

interface Row {
  key: number;
  speaker: 'A' | 'B';
  text: string;
}

@Component({
  selector: 'aula-dialogue-form',
  imports: [IconComponent, LicenseDeclarationComponent, ModeSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <form class="space-y-4" novalidate [attr.data-tried]="tried() ? '' : null" (submit)="$event.preventDefault(); submit()">
      <aula-mode-switch
        name="dialogue-mode"
        [legend]="lb.mode"
        [options]="[
          { value: 'manual', label: lb.modeManual, hint: lb.modeManualHint },
          { value: 'url', label: lb.modeUrl, hint: lb.modeUrlHint },
          { value: 'ai', label: lb.modeAi, hint: lb.modeAiHint },
        ]"
        [(value)]="mode"
      />
      <p class="text-xs text-muted-foreground"><span class="req" aria-hidden="true">*</span> {{ lb.required }}</p>

      <div class="grid gap-3 sm:grid-cols-3">
        <!-- [2026-10-20]: con URL o IA el título, los hablantes y los turnos los rellena el borrador → no se muestran vacíos/«a mano» antes de leerlo -->
        @if (showDetails()) {
          <label class="text-xs font-semibold text-muted-foreground sm:col-span-3">
            {{ lb.dialogueTitle }} <span class="req" aria-hidden="true">*</span>
            <input
              class="control mt-1 w-full"
              required
              minlength="2"
              maxlength="160"
              [value]="title()"
              (input)="title.set($any($event.target).value)"
            />
          </label>
        }
        <label class="text-xs font-semibold text-muted-foreground">
          {{ languageLabel() }} <span class="req" aria-hidden="true">*</span>
          <select class="control mt-1 w-full" required [value]="language()" (change)="language.set($any($event.target).value)">
            @for (code of languages; track code) {
              <option [value]="code">{{ names()[code] ?? code }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ lb.level }}
          <select class="control mt-1 w-full" [value]="level()" (change)="level.set($any($event.target).value)">
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
        <!-- [Tema · 2026-10-20]: solo los temas RELACIONADOS con el título (o el tema de la IA); si no hay ninguno el campo no aparece -->
        @if (relatedTopics().length) {
          <label class="text-xs font-semibold text-muted-foreground">
            {{ lb.topic }}
            <select class="control mt-1 w-full" [value]="topicId()" (change)="topicId.set($any($event.target).value)">
              <option value="">{{ lb.noTopic }}</option>
              @for (t of relatedTopics(); track t.id) {
                <option [value]="t.id" [selected]="t.id === topicId()">{{ t.emoji }} {{ t.title }}</option>
              }
            </select>
          </label>
        }
      </div>

      @if (showDetails()) {
        <fieldset class="grid gap-3 sm:grid-cols-2">
          <legend class="mb-1 text-xs font-semibold text-muted-foreground">{{ lb.speakers }}</legend>
          <input class="control" maxlength="40" aria-label="A" [value]="speakerA()" (input)="speakerA.set($any($event.target).value)" />
          <input class="control" maxlength="40" aria-label="B" [value]="speakerB()" (input)="speakerB.set($any($event.target).value)" />
        </fieldset>
      }

      @switch (mode()) {
        @case ('url') {
          <!-- [Desde una URL]: el texto de la página lo lee Next.js (anti-SSRF) y NestJS arma los turnos -->
          <div class="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
            <label class="min-w-64 flex-1 text-xs font-semibold text-muted-foreground">
              {{ lb.url }} <span class="req" aria-hidden="true">*</span>
              <input
                class="control mt-1 w-full"
                type="url"
                inputmode="url"
                placeholder="https://…"
                [required]="mode() === 'url'"
                [value]="url()"
                (input)="url.set($any($event.target).value)"
              />
            </label>
            <button type="button" class="btn btn-primary" [disabled]="!validUrl() || busy()" (click)="ask('url')"><aula-icon name="link" /> {{ lb.readUrl }}</button>
          </div>
        }
        @case ('ai') {
          <!-- [Con IA]: diálogo original del tema, en el idioma y nivel elegidos -->
          <div class="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
            <label class="min-w-64 flex-1 text-xs font-semibold text-muted-foreground">
              {{ lb.aiTopic }} <span class="req" aria-hidden="true">*</span>
              <input
                class="control mt-1 w-full"
                maxlength="160"
                [required]="mode() === 'ai'"
                [placeholder]="lb.aiTopicPlaceholder"
                [value]="aiTopic()"
                (input)="aiTopic.set($any($event.target).value)"
              />
            </label>
            <label class="w-24 text-xs font-semibold text-muted-foreground">
              {{ lb.aiTurns }}
              <input class="control mt-1 w-full" type="number" min="4" max="20" [value]="aiTurns()" (input)="aiTurns.set(+$any($event.target).value || 8)" />
            </label>
            <button type="button" class="btn btn-primary" [disabled]="aiTopic().trim().length < 2 || busy()" (click)="ask('ai')"><aula-icon name="sparkles" /> {{ lb.generate }}</button>
          </div>
        }
      }
      <p class="text-xs font-semibold text-tone-brand" aria-live="polite">
        {{ busy() && mode() !== 'manual' ? lb.drafting : drafted() ? lb.draftReady : '' }}
      </p>
      @if (drafted() === 'llm') {
        <p class="rounded-lg bg-tone-warning-soft p-2 text-xs font-semibold text-tone-warning"><aula-icon name="triangle-alert" /> {{ lb.aiReview }}</p>
      }

      @if (showDetails()) {
        <ol class="space-y-2">
          @for (r of rows(); track r.key; let i = $index) {
            <li class="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
              <select class="control" [attr.aria-label]="lb.speaker + ' ' + (i + 1)" [value]="r.speaker" (change)="patch(i, { speaker: $any($event.target).value })">
                <option value="A">{{ speakerA() || 'A' }}</option>
                <option value="B">{{ speakerB() || 'B' }}</option>
              </select>
              <input
                class="control"
                maxlength="600"
                [required]="i < 2"
                [attr.lang]="language()"
                [attr.aria-label]="lb.text + ' ' + (i + 1)"
                [value]="r.text"
                (input)="patch(i, { text: $any($event.target).value })"
              />
              <button type="button" class="btn btn-ghost btn-sm" [disabled]="rows().length <= 2" (click)="remove(i)">
                ✕ <span class="sr-only">{{ lb.remove }} {{ i + 1 }}</span>
              </button>
            </li>
          }
        </ol>
        <button type="button" class="btn btn-outline btn-sm" [disabled]="rows().length >= 80" (click)="add()">＋ {{ lb.addTurn }}</button>
      }

      <aula-license-declaration [(value)]="license" [labels]="licenseLabels()" />
      @if (!bothSpeakers()) {
        <p class="text-xs font-semibold text-tone-warning"><aula-icon name="triangle-alert" /> {{ lb.minTurns }}</p>
      }
      <button type="submit" class="btn btn-primary" [disabled]="busy()"><aula-icon name="save" /> {{ lb.save }}</button>
    </form>
  `,
})
export class DialogueFormComponent {
  readonly topics = input<readonly Topic[]>([]);
  readonly names = input<Record<string, string>>({});
  readonly languageLabel = input.required<string>();
  readonly labels = input.required<DialogueFormLabels>();
  readonly licenseLabels = input.required<LicenseLabels>();
  readonly busy = input(false);
  readonly draft = input<DialogueDraft | null>(null); // Borrador que devolvió el contenedor (URL o IA)
  readonly initialLanguage = input<string | undefined>(undefined); // [2026-10-24]: ?idioma= desde Gestión
  readonly initialLevel = input<string | undefined>(undefined); // ?nivel=
  readonly initialMode = input<string | undefined>(undefined); // [2026-10-23]: ?modo=ia|url desde Gestión → abre directo en ese modo
  readonly save = output<DialogueInput>();
  readonly requestDraft = output<DraftAsk>();
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly mode = signal<string>('manual');
  protected readonly title = signal('');
  protected readonly language = signal<string>('en');
  protected readonly level = signal<string>('A2');
  protected readonly topicId = signal('');
  protected readonly speakerA = signal('Ana');
  protected readonly speakerB = signal('Tom');
  protected readonly url = signal('');
  protected readonly aiTopic = signal('');
  protected readonly aiTurns = signal(8);
  protected readonly drafted = signal<'script' | 'llm' | null>(null);
  protected readonly tried = signal(false);
  protected readonly license = signal<LicenseValue>({ ...EMPTY_LICENSE });
  private seq = 2;
  protected readonly rows = signal<Row[]>([
    { key: 0, speaker: 'A', text: '' },
    { key: 1, speaker: 'B', text: '' },
  ]);
  protected readonly filled = computed(() => this.rows().filter((r) => r.text.trim()));
  protected readonly bothSpeakers = computed(() => new Set(this.filled().map((r) => r.speaker)).size === 2);
  protected readonly valid = computed(() => this.title().trim().length >= 2 && this.bothSpeakers() && !licenseProblem(this.license()));
  // `URL.canParse` (WHATWG, 2023): valida sin try/catch
  protected readonly validUrl = computed(() => /^https?:\/\//i.test(this.url().trim()) && URL.canParse(this.url().trim()));
  // [showDetails]: manual → siempre; URL/IA → cuando ya llegó el borrador
  protected readonly showDetails = computed(() => this.mode() === 'manual' || !!this.drafted());
  // [relatedTopics · 2026-10-20]: temas cuyas palabras (título, slug o vocabulario del idioma) aparecen en el título del diálogo o el tema de la IA
  protected readonly relatedTopics = computed(() => {
    const words = tokens(`${this.title()} ${this.mode() === 'ai' ? this.aiTopic() : ''}`);
    if (!words.size) return [];
    return this.topics()
      .map((t) => ({ t, score: [...tokens(`${t.title} ${t.slug ?? ''} ${(t.vocabulary?.[this.language()] ?? []).join(' ')}`)].filter((w) => words.has(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t);
  });

  constructor() {
    // [Modo inicial]: solo valores conocidos; el usuario puede cambiarlo después con el selector
    effect(() => {
      const m = this.initialMode();
      if (m === 'ia' || m === 'ai') untracked(() => this.mode.set('ai'));
      else if (m === 'url' || m === 'importar') untracked(() => this.mode.set('url'));
    });
    // [Prefill · 2026-10-24]: idioma y nivel elegidos en Gestión → valor inicial (solo valores conocidos)
    effect(() => {
      const [language, level] = [pickLanguage(this.initialLanguage()), pickLevel(this.initialLevel())];
      untracked(() => {
        if (language) this.language.set(language);
        if (level) this.level.set(level);
      });
    });
    // [Tema sugerido]: el más relacionado queda elegido (se puede cambiar o quitar); si deja de estar relacionado se limpia
    effect(() => {
      const related = this.relatedTopics();
      untracked(() => {
        if (!related.some((t) => t.id === this.topicId())) this.topicId.set(related[0]?.id ?? '');
      });
    });
    // [Licencia desde la URL · 2026-10-20]: la fuente ES la URL escrita arriba (no se pide dos veces) y el titular se propone por el dominio
    effect(() => {
      const source = this.mode() === 'url' && this.validUrl() ? this.url().trim() : '';
      if (!source) return;
      untracked(() =>
        this.license.update((l) => ({
          ...l,
          type: l.type === 'own_work' ? 'permission' : l.type, // Una página ajena no es «obra propia»
          source,
          holder: l.holder.trim() && l.source === source ? l.holder : holderFromUrl(source) || l.holder,
        })),
      );
    });
    // [Borrador recibido]: rellena título (si está vacío), hablantes y turnos para revisarlos
    effect(() => {
      const d = this.draft();
      if (!d) return;
      untracked(() => {
        if (!this.title().trim() && d.title) this.title.set(d.title);
        this.speakerA.set(d.speakers[0]);
        this.speakerB.set(d.speakers[1]);
        this.rows.set(d.turns.map((t) => ({ key: this.seq++, speaker: t.speaker, text: t.text })));
        this.drafted.set(d.source);
        // [Licencia]: con URL la fuente es esa página y el titular el que declara la página (autor/sitio) o su dominio; con IA es contenido propio generado
        if (this.mode() === 'url') {
          const source = this.url().trim();
          this.license.update((l) => ({ ...l, source, holder: d.holder?.trim() || l.holder.trim() || holderFromUrl(source) || '' }));
        } else if (this.mode() === 'ai') {
          this.license.update((l) => ({ ...l, type: 'own_work', source: l.source, holder: l.holder.trim() || 'Aula de Idiomas · generado con IA' }));
          if (!this.title().trim()) this.title.set(this.aiTopic().trim());
        }
      });
    });
  }

  protected ask(mode: 'url' | 'ai'): void {
    this.requestDraft.emit({
      mode,
      url: mode === 'url' ? this.url().trim() : undefined,
      topic: mode === 'ai' ? this.aiTopic().trim() : undefined,
      language: this.language(),
      level: this.level(),
      turns: Math.min(Math.max(this.aiTurns(), 4), 20),
      title: this.title().trim() || undefined,
      // [URL]: los nombres los trae el guion de la página (no se fuerzan «Ana/Tom»); con IA sí se usan los del formulario
      speakers: mode === 'url' ? undefined : [this.speakerA().trim(), this.speakerB().trim()],
    });
  }

  protected add(): void {
    const last = this.rows().at(-1)?.speaker ?? 'B';
    this.rows.update((r) => [...r, { key: this.seq++, speaker: last === 'A' ? 'B' : 'A', text: '' }]); // Alterna el hablante
  }

  protected remove(i: number): void {
    this.rows.update((r) => r.filter((_, j) => j !== i));
  }

  protected patch(i: number, p: Partial<Row>): void {
    this.rows.update((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }

  // [submit]: el botón siempre se puede pulsar → si falta algo, los obligatorios quedan en rojo (data-tried) y no se envía | [Principio]: Fail Fast
  protected submit(): void {
    this.tried.set(true);
    if (!this.valid() || this.busy()) return;
    this.save.emit({
      title: this.title().trim(),
      language: this.language(),
      topicId: this.topicId() || undefined,
      speakers: [this.speakerA().trim() || 'A', this.speakerB().trim() || 'B'],
      turns: this.filled().map((r) => ({ speaker: r.speaker, text: r.text.trim() })),
      license: this.license(),
    });
  }
}
