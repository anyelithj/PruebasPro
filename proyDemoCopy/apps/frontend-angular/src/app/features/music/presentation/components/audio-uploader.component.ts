import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { classifyMediaLink, NO_LINK_RULES, type MediaLinkRules } from '../../domain/models/music';
// [AudioUploaderComponent · Presentacional · Sprint 9.9 · RF-116]: elegir el audio con límite de tamaño comprobado ANTES de subir | [Patrón]: Presentational Component + Fail Fast | [Principio]: SRP (subir lo hace la fachada) | [Paradigma]: Declarativo + Reactivo
// [A11y]: <input type="file"> nativo con etiqueta visible; el error en texto con role="alert"
// [2026-10-24 · Enlace del audio]: el enlace se clasifica en el cliente (Specification `classifyMediaLink` + dominios de GET /music/link-rules) ANTES del POST → página de letras = acción «Importar la letra desde este enlace»; streaming = explicación; formato inválido = aviso. Así no hay 400 esperable en la consola | [Patrón]: Fail Fast + Progressive Disclosure

// [AudioLinkLabels]: textos del aviso del enlace (i18n music.wizard.audioLink) | `interface` (TS): se borra al compilar
export interface AudioLinkLabels {
  invalid: string;
  lyricsPage: string;
  importLyrics: string;
  importingLyrics: string;
  streamingPage: string;
}

let nextId = 0; // Contador del módulo → ids únicos para aria-describedby aunque haya varios cargadores en la página

@Component({
  selector: 'aula-audio-uploader',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="space-y-2">
      <label class="block text-xs font-semibold text-muted-foreground">
        {{ label() }}
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          class="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-tone-brand-soft file:px-4 file:py-2 file:font-semibold file:text-tone-brand hover:file:bg-tone-brand-line"
          (change)="pick($any($event.target).files?.[0] ?? null)"
        />
      </label>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!file() || busy()"
          (click)="upload.emit(file()!)"
        >
          <aula-icon name="upload" /> {{ uploadLabel() }}
        </button>
        @if (done()) {
          <span class="text-sm font-semibold text-tone-brand">✓ {{ doneLabel() }}</span>
        }
      </div>
      <!-- [2026-10-23]: o un enlace directo (.mp3, .mp4…) que el servidor descarga con el mismo límite -->
      @if (urlLabel()) {
        <form class="flex flex-wrap items-end gap-2" novalidate (submit)="$event.preventDefault(); submitLink()">
          <label class="block min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
            <aula-icon name="link" /> {{ urlLabel() }}
            <!-- aria-invalid / aria-describedby: el lector de pantalla anuncia el aviso asociado al campo -->
            <input
              type="url"
              class="control mt-1 w-full"
              placeholder="https://…/cancion.mp3"
              [value]="link()"
              [attr.aria-invalid]="linkHint() ? 'true' : null"
              [attr.aria-describedby]="linkHint() ? hintId : null"
              (input)="link.set($any($event.target).value)"
              (blur)="touched.set(true)"
            />
          </label>
          <!-- [2026-10-25]: UN solo botón → enlace directo = importar el audio · página de letras = importar la letra (antes aparecía un segundo botón) -->
          <button type="submit" class="btn btn-outline" [disabled]="busy() || importingLyrics() || !link().trim()">
            @if (kind() === 'lyrics_page' && linkLabels(); as lb) {
              <aula-icon name="file-text" /> {{ importingLyrics() ? lb.importingLyrics : lb.importLyrics }}
            } @else {
              <aula-icon name="download" /> {{ urlButton() }}
            }
          </button>
        </form>
        <!-- [Aviso del enlace]: role="status" (informativo, no bloquea) · página de letras → botón que la importa al paso «Letra» -->
        @if (linkHint(); as hint) {
          <div [id]="hintId" role="status" class="flex flex-wrap items-center gap-2 rounded-lg bg-tone-warning-soft p-2 text-xs font-semibold text-tone-warning">
            <aula-icon [name]="kind() === 'lyrics_page' ? 'file-text' : 'triangle-alert'" />
            <span class="min-w-0 flex-1">{{ hint }}</span>
          </div>
        }
      }
      @if (error()) {
        <p role="alert" class="text-xs font-semibold text-tone-danger">{{ error() }}</p>
      }
    </div>
  `,
})
export class AudioUploaderComponent {
  readonly label = input.required<string>();
  readonly uploadLabel = input.required<string>();
  readonly doneLabel = input('');
  readonly tooBig = input.required<string>();
  readonly maxMb = input(20);
  readonly busy = input(false);
  readonly done = input(false);
  readonly upload = output<File>();
  readonly urlLabel = input(''); // Vacío = sin opción de enlace
  readonly urlButton = input('');
  readonly uploadUrl = output<string>();
  readonly linkRules = input<MediaLinkRules>(NO_LINK_RULES); // [2026-10-24]: dominios de letras/streaming (vacío = solo se valida el formato)
  readonly linkLabels = input<AudioLinkLabels | null>(null);
  readonly importingLyrics = input(false);
  readonly importLyrics = output<string>(); // La página lee la letra (POST /music/lyrics/from-url) y abre el paso «Letra»
  protected readonly link = signal('');
  protected readonly touched = signal(false); // El aviso de formato aparece al salir del campo o al enviar (no mientras se escribe)
  protected readonly hintId = `audio-link-hint-${nextId++}`;
  // [kind]: tipo de enlace | `computed` (signals): se recalcula al escribir o al llegar las reglas
  protected readonly kind = computed(() => classifyMediaLink(this.link(), this.linkRules()));
  // [linkHint]: texto del aviso o '' (sin aviso) | `switch` sobre la unión de literales
  protected readonly linkHint = computed(() => {
    const lb = this.linkLabels();
    if (!lb) return '';
    switch (this.kind()) {
      case 'lyrics_page':
        return lb.lyricsPage;
      case 'streaming_page':
        return lb.streamingPage;
      case 'invalid':
        return this.touched() ? lb.invalid : '';
      default:
        return '';
    }
  });

  // [submitLink]: solo un enlace directo llega al servidor; el resto deja el aviso visible (Fail Fast, sin 400 esperable)
  protected submitLink(): void {
    this.touched.set(true);
    if (this.kind() === 'direct') this.uploadUrl.emit(this.link().trim());
    else if (this.kind() === 'lyrics_page') this.importLyrics.emit(this.link().trim());
  }
  protected readonly file = signal<File | null>(null);
  protected readonly error = signal('');

  protected pick(f: File | null): void {
    const tooBig = !!f && f.size > this.maxMb() * 1024 * 1024;
    this.error.set(tooBig ? this.tooBig() : '');
    this.file.set(tooBig ? null : f);
  }
}
