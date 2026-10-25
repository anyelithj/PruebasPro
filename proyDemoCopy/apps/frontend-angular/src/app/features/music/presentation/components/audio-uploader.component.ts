import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
// [AudioUploaderComponent · Presentacional · Sprint 9.9 · RF-116]: elegir el audio con límite de tamaño comprobado ANTES de subir | [Patrón]: Presentational Component + Fail Fast | [Principio]: SRP (subir lo hace la fachada) | [Paradigma]: Declarativo + Reactivo
// [A11y]: <input type="file"> nativo con etiqueta visible; el error en texto con role="alert"

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
        <form class="flex flex-wrap items-end gap-2" (submit)="$event.preventDefault(); uploadUrl.emit(link().trim())">
          <label class="block min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
            <aula-icon name="link" /> {{ urlLabel() }}
            <input type="url" class="control mt-1 w-full" placeholder="https://…/cancion.mp3" [value]="link()" (input)="link.set($any($event.target).value)" />
          </label>
          <button type="submit" class="btn btn-outline" [disabled]="busy() || !link().trim()"><aula-icon name="download" /> {{ urlButton() }}</button>
        </form>
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
  protected readonly link = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly error = signal('');

  protected pick(f: File | null): void {
    const tooBig = !!f && f.size > this.maxMb() * 1024 * 1024;
    this.error.set(tooBig ? this.tooBig() : '');
    this.file.set(tooBig ? null : f);
  }
}
