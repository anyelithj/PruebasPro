import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TEXT_IMPORT_ACCEPT, TextImportService, type ExtractedText } from '@core/media/text-import.service';
// [TextImportComponent · Molécula · 2026-10-23]: «Importar desde archivo o enlace» — PDF, Word, texto o imagen (OCR) y URL → emite el texto leído para rellenar un formulario
// [Patrón]: Atomic Design (molécula) + Facade (TextImportService) | [Principio]: SRP (no sabe qué se rellena) + DRY (letra de canciones, actividades…) | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: <input type="file"> y <input type="url"> nativos con etiqueta visible · progreso con aria-live · error con role="alert"

export interface TextImportLabels {
  file: string; // «Desde un archivo (PDF, Word, texto o imagen)»
  url: string; // «O desde un enlace»
  read: string; // Botón «Leer enlace»
  reading: string; // «Leyendo…»
}

@Component({
  selector: 'aula-text-import',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <div class="grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
      <label class="block text-xs font-semibold text-muted-foreground">
        <aula-icon name="file-text" /> {{ lb.file }}
        <input
          type="file"
          [accept]="accept"
          class="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-tone-brand-soft file:px-4 file:py-2 file:font-semibold file:text-tone-brand hover:file:bg-tone-brand-line"
          [disabled]="busy()"
          (change)="readFile($any($event.target))"
        />
      </label>
      <form class="flex items-end gap-2" (submit)="$event.preventDefault(); readUrl()">
        <label class="block min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
          <aula-icon name="link" /> {{ lb.url }}
          <input
            type="url"
            class="control mt-1 w-full"
            placeholder="https://…"
            [value]="link()"
            (input)="link.set($any($event.target).value)"
          />
        </label>
        <button type="submit" class="btn btn-outline" [disabled]="busy() || !link().trim()">{{ lb.read }}</button>
      </form>
      @if (busy()) {
        <p class="text-xs text-muted-foreground sm:col-span-2" aria-live="polite"><aula-icon name="hourglass" /> {{ lb.reading }}</p>
      }
      @if (error()) {
        <p role="alert" class="text-xs font-semibold text-tone-danger sm:col-span-2">{{ error() }}</p>
      }
    </div>
  `,
})
export class TextImportComponent {
  private readonly importer = inject(TextImportService);
  readonly language = input('en'); // Idioma del contenido (modelo de OCR)
  readonly labels = input.required<TextImportLabels>();
  readonly imported = output<ExtractedText>();
  protected readonly accept = TEXT_IMPORT_ACCEPT;
  protected readonly link = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readFile(el: HTMLInputElement): void {
    const file = el.files?.[0];
    el.value = ''; // Permite volver a elegir el mismo archivo
    if (file) void this.run(() => this.importer.fromFile(file, this.language()));
  }

  protected readUrl(): void {
    void this.run(() => this.importer.fromUrl(this.link().trim(), this.language()));
  }

  // [run]: un solo manejo de estado y errores para archivo y enlace | [Principio]: DRY
  private async run(task: () => Promise<ExtractedText>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.imported.emit(await task());
    } catch (err) {
      const body = (err as { error?: { message?: string } }).error; // HttpErrorResponse.error del Route Handler
      this.error.set(body?.message ?? (err instanceof Error ? err.message : String(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
