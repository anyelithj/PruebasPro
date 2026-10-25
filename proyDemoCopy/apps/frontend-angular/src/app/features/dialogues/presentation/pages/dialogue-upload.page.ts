import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { SyncedTranscriptComponent } from '@shared/ui/organisms/synced-transcript/synced-transcript.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialoguesFacade } from '../../application/dialogues.facade';
import { toTranscript, type DialogueDraft, type DialogueInput } from '../../domain/models/dialogues';
import { DialogueFormComponent, type DraftAsk } from '../components/dialogue-form.component';
import { LevelBadgeComponent } from '../components/level-badge.component';
import { LevelConfirmComponent } from '../components/level-confirm.component';
// [DialogueUploadPage · Presentación · Sprint 9.13 · RF-125/RF-126/RF-128]: /dialogos/subir[/:id] — escribir el diálogo por hablante con licencia; NestJS obtiene IPA y traducción y FastAPI estima el nivel; el docente lo confirma (o cambia) y opcionalmente sube el audio, que se sincroniza solo | [Patrón]: Container (smart) + State Machine (borrador → nivel estimado → confirmado) + Facade | [Principio]: SRP + verificación humana + cumplimiento de derechos de autor | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-dialogue-upload-page',
  imports: [IconComponent, 
    ReturnLinkComponent,
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    SyncedTranscriptComponent,
    DialogueFormComponent,
    LevelBadgeComponent,
    LevelConfirmComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    @let d = id() ? dialogues.dialogue.data() : null;
    <aula-card-page
      [heading]="d?.title ?? tx.form.title"
      [subtitle]="d ? i18n.languageName(d.language) : tx.librarySubtitle"
    >
      <aula-return-link pageBack fallback="/dialogos/biblioteca" [label]="tx.backToLibrary" />
      @if (!id()) {
        <aula-dialogue-form
          [initialMode]="modo()"
          [initialLanguage]="idioma()"
          [initialLevel]="nivel()"
          [topics]="dialogues.topics.data() ?? []"
          [names]="names()"
          [languageLabel]="tx.language"
          [labels]="tx.form"
          [licenseLabels]="i18n.t().media.license"
          [busy]="dialogues.busy()"
          [draft]="draft()"
          (save)="create($event)"
          (requestDraft)="askDraft($event)"
        />
        @if (dialogues.busy()) {
          <aula-spinner class="mt-3" [label]="tx.form.save" />
        }
      } @else {
        @switch (dialogues.dialogue.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ dialogues.dialogue.error() }}</p>
          }
        }
        @if (d) {
          <div class="space-y-6">
            <p class="flex flex-wrap items-center gap-2 text-sm">
              <aula-level-badge
                [level]="d.level"
                [status]="d.levelStatus"
                [labels]="tx.levelBadge"
              />
              <span class="text-muted-foreground">{{ d.speakers.join(' · ') }}</span>
            </p>
            @if (d.editable) {
              <aula-level-confirm
                [estimate]="d.levelEstimate"
                [current]="d.level"
                [confirmed]="d.levelStatus === 'confirmed'"
                [busy]="dialogues.busy()"
                [labels]="tx.confirm"
                (confirm)="dialogues.confirmLevel(d.id, $event)"
              />
              <section class="space-y-2" aria-labelledby="dialogue-audio">
                <h2 id="dialogue-audio" class="text-base font-extrabold">{{ tx.form.audio }}</h2>
                <label class="block text-xs font-semibold text-muted-foreground">
                  {{ i18n.fmt(i18n.t().music.wizard.audio, { mb: maxMb }) }}
                  <input
                    type="file"
                    accept="audio/*"
                    class="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-tone-brand-soft file:px-4 file:py-2 file:font-semibold file:text-tone-brand"
                    (change)="pick($any($event.target).files?.[0] ?? null)"
                  />
                </label>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="!file() || dialogues.busy()"
                  (click)="audio()"
                >
                  <aula-icon name="upload" /> {{ tx.form.uploadAudio }}
                </button>
                @if (tooBig()) {
                  <p role="alert" class="text-xs font-semibold text-tone-danger">
                    {{ i18n.fmt(i18n.t().music.wizard.audioTooBig, { mb: maxMb }) }}
                  </p>
                }
                @if (aligned() !== null || d.hasAudio) {
                  <p class="text-sm font-semibold text-tone-brand" role="status">
                    ✓ {{ aligned() === false ? tx.form.notAligned : tx.form.aligned }}
                  </p>
                }
              </section>
            }
            <section aria-labelledby="dialogue-preview">
              <h2 id="dialogue-preview" class="mb-2 text-base font-extrabold">
                {{ tx.form.preview }}
              </h2>
              <aula-synced-transcript
                [lines]="lines()"
                [language]="d.language"
                [labels]="i18n.t().media.transcript"
              />
            </section>
            <div class="flex flex-wrap gap-2 border-t border-border pt-4">
              @if (d.levelStatus === 'confirmed') {
                <a class="btn btn-primary" [routerLink]="['/dialogos', d.id]">▶ {{ tx.open }}</a>
              }
              @if (d.editable) {
                <button
                  type="button"
                  class="btn btn-danger ml-auto"
                  [disabled]="dialogues.busy()"
                  (click)="withdraw()"
                >
                  <aula-icon name="trash-2" /> {{ tx.form.withdraw }}
                </button>
              }
            </div>
          </div>
        }
      }
      @if (dialogues.actionError()) {
        <p role="alert" class="mt-3 text-sm text-tone-danger">{{ dialogues.actionError() }}</p>
      }
    </aula-card-page>
  `,
})
export default class DialogueUploadPage {
  protected readonly i18n = inject(I18nService);
  protected readonly dialogues = inject(DialoguesFacade);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ReturnToService); // [2026-10-23]: conserva ?volver= y regresa a Gestión
  readonly id = input<string>(); // /dialogos/subir/:id (opcional: sin id = diálogo nuevo)
  readonly modo = input<string>(); // [2026-10-23]: ?modo=ia|url (Gestión → «Con IA» / «Importar»)
  readonly idioma = input<string>(); // [2026-10-24]: ?idioma= (withComponentInputBinding)
  readonly nivel = input<string>(); // ?nivel=
  protected readonly aligned = signal<boolean | null>(null);
  protected readonly draft = signal<DialogueDraft | null>(null); // [2026-10-19]: borrador desde URL o IA para revisar en el formulario
  protected readonly maxMb = 20; // Mismo límite que NestJS y el BFF de Next.js
  protected readonly file = signal<File | null>(null);
  protected readonly tooBig = signal(false);
  protected readonly names = computed(() =>
    Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])),
  );
  protected readonly lines = computed(() => {
    const d = this.dialogues.dialogue.data();
    return (d?.turns ?? []).map((t) => toTranscript(t, { A: d?.speakers[0], B: d?.speakers[1] }));
  });

  constructor() {
    void this.dialogues.loadTopics({});
    effect(() => {
      const id = this.id();
      if (id) void this.dialogues.loadDialogue(id);
    });
  }

  protected async create(input: DialogueInput): Promise<void> {
    const d = await this.dialogues.create(input);
    if (d) await this.returnTo.go(['/dialogos/subir', d.id]); // Siguiente paso: confirmar el nivel estimado
  }

  // [askDraft · 2026-10-19]: modo URL → texto de la página → guion · modo IA → diálogo original; el formulario lo muestra para revisarlo
  protected async askDraft(a: DraftAsk): Promise<void> {
    const req = { language: a.language, level: a.level, title: a.title, speakers: a.speakers, topic: a.topic, turns: a.turns };
    const d = a.mode === 'url' ? await this.dialogues.draftFromUrl(a.url!, req) : await this.dialogues.draftWithAi(req);
    if (d) this.draft.set(d);
  }

  // [pick]: tamaño comprobado antes de subir (Fail Fast)
  protected pick(f: File | null): void {
    this.tooBig.set(!!f && f.size > this.maxMb * 1024 * 1024);
    this.file.set(this.tooBig() ? null : f);
  }

  protected async audio(): Promise<void> {
    const f = this.file();
    if (f) this.aligned.set(await this.dialogues.uploadAudio(this.id()!, f));
  }

  protected async withdraw(): Promise<void> {
    if (await this.dialogues.withdraw(this.id()!))
      await this.returnTo.leave('/dialogos/biblioteca');
  }
}
