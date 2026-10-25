import { ChangeDetectionStrategy, Component, inject, input, numberAttribute, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ReportsFacade } from '../../application/reports.facade';
import { REPORT_FORMATS, type ReportFormat } from '../../domain/models/reports';
import { REPORTS_PROVIDERS } from '../../reports.providers';
// [ReportExportButtonElement · Angular Element <aula-exportar>]: exportar el reporte del periodo que se está viendo — un SELECT de formato (PDF, Excel, Word) + botón «Exportar» | [Patrón]: Container autónomo (trae sus providers) + Command | [Principio]: SRP + DRY (misma fachada que /reportes/exportaciones) + OCP (formato nuevo = una opción) | [Paradigma]: Declarativo
// [2026-10-19]: antes eran dos botones pequeños (btn-sm) desalineados con «Filtrar»; ahora select y botón miden 40 px como el resto de la barra
// [Uso en Next.js]: <aula-exportar period-months="6"></aula-exportar> · el aviso «listo» llega a la campana por SSE
// [A11y]: select con etiqueta (sr-only) · resultado en role="status" · errores en role="alert"

@Component({
  selector: 'aula-report-export-button',
  imports: [ButtonComponent, IconComponent],
  providers: REPORTS_PROVIDERS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().reports;
    <div class="flex flex-wrap items-center gap-2">
      <label class="sr-only" for="export-format">{{ t.format }}</label>
      <select id="export-format" class="control" [value]="format()" (change)="format.set($any($event.target).value)">
        @for (f of formats; track f) {
          <option [value]="f">{{ t.formats[f] }}</option>
        }
      </select>
      <button aulaButton type="button" variant="primary" [loading]="facade.requesting()" (click)="request()">
        <aula-icon [name]="format() === 'xlsx' ? 'sheet' : 'file'" />
        {{ t.export }}
      </button>
      @if (facade.lastRequested()) {
        <p role="status" class="w-full text-xs text-muted-foreground">
          {{ t.requested }} <a class="font-semibold text-primary hover:underline" href="/reportes/exportaciones">{{ i18n.t().nav.exports }}</a>
        </p>
      }
      @if (facade.actionError(); as err) {
        <p role="alert" class="w-full text-xs text-tone-danger">{{ err }}</p>
      }
    </div>
  `,
})
export class ReportExportButtonElement {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(ReportsFacade);
  protected readonly formats = REPORT_FORMATS;
  protected readonly format = signal<ReportFormat>('pdf');
  // `numberAttribute` (Angular): el atributo HTML llega como texto → se convierte a número (NaN/0 = todo el histórico)
  readonly periodMonths = input(0, { transform: numberAttribute });

  protected request(): void {
    void this.facade.request(this.format(), this.periodMonths() || null);
  }
}
