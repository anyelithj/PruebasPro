import type { Provider } from '@angular/core';
import { ReportsFacade } from './application/reports.facade';
import { ReportsRepository } from './domain/reports.repository.port';
import { ReportsHttpRepository } from './infrastructure/reports.http-repository';
// [REPORTS_PROVIDERS]: puerto → adaptador + fachada, compartidos por /reportes/exportaciones y <aula-exportar> | [Patrón]: Composition Root | [Principio]: DRY + DIP

export const REPORTS_PROVIDERS: Provider[] = [{ provide: ReportsRepository, useClass: ReportsHttpRepository }, ReportsFacade];
