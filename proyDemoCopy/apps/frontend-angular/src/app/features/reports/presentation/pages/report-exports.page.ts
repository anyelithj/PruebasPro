import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent, type BadgeTone } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent, type IconName } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { DataTableComponent, type DataColumn } from '@shared/ui/organisms/data-table/data-table.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReportsFacade } from '../../application/reports.facade';
import { formatSize, PERIOD_MONTHS, REPORT_FORMATS, type ReportExport, type ReportFormat, type ReportStatus } from '../../domain/models/reports';
// [ReportExportsPage · Presentación]: solicitar exportaciones por periodo y seguir su estado en vivo (tabla con descarga y borrado) | [Patrón]: Container + Template Method (celdas de la tabla) + Máquina de estados | [Principio]: SRP + DIP + DRY (DataTable compartida) | [Paradigma]: Declarativo + Reactivo
// [A11y]: estados con texto + icono (no solo color) · tabla con caption · acciones con nombre accesible propio por fila

// [Estado → tono + icono]: `Record` (TS) exhaustivo → el compilador avisa si falta un estado
const STATUS_UI: Record<ReportStatus, { tone: BadgeTone; icon: IconName }> = {
  pending: { tone: 'warning', icon: 'refresh' },
  processing: { tone: 'brand', icon: 'spark' },
  ready: { tone: 'info', icon: 'check' },
  failed: { tone: 'danger', icon: 'alert' },
};

@Component({
  selector: 'aula-report-exports-page',
  imports: [CardPageTemplate, DataTableComponent, BadgeComponent, ButtonComponent, IconComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().reports;
    <aula-card-page [heading]="t.title" [subtitle]="t.subtitle">
      <ng-container pageActions>
        <label class="sr-only" for="report-period">{{ t.period }}</label>
        <select id="report-period" class="control" [value]="period()" (change)="period.set(+$any($event.target).value)">
          <option [value]="0">{{ t.allTime }}</option>
          @for (m of periods; track m) {
            <option [value]="m">{{ i18n.fmt(t.months, { n: m }) }}</option>
          }
        </select>
        <!-- [2026-10-19]: select de formato (PDF, Excel, Word) + un botón «Exportar», igual que en /admin/reports -->
        <label class="sr-only" for="report-format">{{ t.format }}</label>
        <select id="report-format" class="control" [value]="format()" (change)="format.set($any($event.target).value)">
          @for (f of formats; track f) {
            <option [value]="f">{{ t.formats[f] }}</option>
          }
        </select>
        <button aulaButton type="button" variant="primary" [loading]="facade.requesting()" (click)="request(format())">
          <aula-icon [name]="format() === 'xlsx' ? 'sheet' : 'file'" />
          {{ t.export }}
        </button>
      </ng-container>

      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }

      @switch (facade.exports.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.exports.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load()">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @default {
          <aula-data-table [caption]="t.title" [columns]="columns()" [rows]="facade.exports.data() ?? []" [empty]="t.empty" [trackBy]="byId">
            <ng-template #cell let-row let-column="column">
              @switch (column) {
                @case ('format') {
                  <span class="inline-flex items-center gap-1.5 font-semibold"><aula-icon [name]="row.format === 'xlsx' ? 'sheet' : 'file'" />{{ formatName(row.format) }}</span>
                }
                @case ('status') {
                  <aula-badge [tone]="ui(row).tone" [icon]="ui(row).icon">{{ t.status[ui(row).key] }}</aula-badge>
                }
                @case ('createdAt') {
                  <time [attr.datetime]="row.createdAt">{{ date(row.createdAt) }}</time>
                }
                @case ('sizeBytes') {
                  {{ size(row.sizeBytes) }}
                }
                @case ('id') {
                  <span class="flex justify-end gap-1">
                    @if (row.status === 'ready') {
                      <!-- <a download> (HTML nativo): el BFF transmite el archivo desde MinIO, sin JS -->
                      <a aulaButton variant="outline" size="sm" download [href]="facade.downloadUrl(row.id)" [attr.aria-label]="t.download + ' ' + row.format">
                        <aula-icon name="download" />
                      </a>
                    }
                    <button aulaButton variant="ghost" size="sm" type="button" class="text-tone-danger" [attr.aria-label]="t.remove + ' ' + row.format" (click)="facade.remove(row.id)">
                      <aula-icon name="trash" />
                    </button>
                  </span>
                }
              }
            </ng-template>
          </aula-data-table>
        }
      }
    </aula-card-page>
  `,
})
export default class ReportExportsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(ReportsFacade);
  protected readonly formats = REPORT_FORMATS;
  protected readonly format = signal<ReportFormat>('pdf');
  // [formatName]: «PDF» · «Excel» · «Word» (la fila de la tabla llega sin tipo desde la plantilla)
  protected formatName(f: ReportFormat): string {
    return this.i18n.t().reports.formats[f];
  }
  protected readonly periods = PERIOD_MONTHS;
  protected readonly period = signal(0); // 0 = todo el histórico
  protected readonly byId = (r: ReportExport) => r.id;

  // `computed`: cabeceras traducidas (se recalculan al cambiar el idioma)
  protected readonly columns = computed<DataColumn<ReportExport>[]>(() => {
    const t = this.i18n.t().reports;
    return [
      { key: 'format', header: t.format },
      { key: 'createdAt', header: t.created },
      { key: 'status', header: t.statusCol },
      { key: 'sizeBytes', header: t.size, align: 'end' },
      { key: 'id', header: t.actions, align: 'end' },
    ];
  });

  constructor() {
    void this.facade.load();
    this.facade.connect(inject(DestroyRef));
  }

  protected request(format: ReportFormat): void {
    void this.facade.request(format, this.period() || null);
  }

  // [ui]: tono, icono y clave del estado de la fila (la fila de la plantilla llega sin tipo → se tipa aquí)
  protected ui(row: ReportExport) {
    return { ...STATUS_UI[row.status], key: row.status };
  }

  protected size(bytes: number | null): string {
    return formatSize(bytes);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.intl());
  }
}
