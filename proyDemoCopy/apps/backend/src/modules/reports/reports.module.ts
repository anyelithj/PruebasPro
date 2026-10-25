import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObjectStore } from '../../shared/storage/object-store';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuizModule } from '../quiz/quiz.module';
import { ScoreModule } from '../score/score.module';
import { UsersModule } from '../users/users.module';
import { ReportDataQuery } from './application/queries/report-data.query';
import {
  DeleteReportExportUseCase,
  DownloadReportExportUseCase,
  ListMyExportsUseCase,
  REPORTS_STORE,
} from './application/use-cases/download-report-export.use-case';
import {
  REPORT_EXPORT_QUEUE,
  RequestReportExportUseCase,
} from './application/use-cases/request-report-export.use-case';
import { ReportExport } from './domain/entities/report-export.entity';
import { REPORT_RENDERERS } from './domain/report-data';
import { ReportExportProcessor } from './infrastructure/queue/report-export.processor';
import { ReportPdfRenderer } from './infrastructure/renderers/report-pdf.renderer';
import { ReportXlsxRenderer } from './infrastructure/renderers/report-xlsx.renderer';
import { ReportDocxRenderer } from './infrastructure/renderers/report-docx.renderer';
import { ReportExportsController } from './presentation/report-exports.controller';
// [ReportsModule · Sprint 6.4]: exportación asíncrona del reporte del sistema (PDF/Excel) con Bull + almacén de objetos (disco, MinIO o R2) + aviso SSE | [Patrón]: Module + DI Container + Strategy Registry | [Principio]: DIP + OCP

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportExport]),
    BullModule.registerQueue({ name: REPORT_EXPORT_QUEUE }), // Conexión Redis heredada de BullModule.forRootAsync (AppModule)
    UsersModule, // USER_REPOSITORY
    ScoreModule, // SCORE_REPOSITORY
    QuizModule, // QUIZ_REPOSITORY
    NotificationsModule, // PublishNotificationUseCase
  ],
  controllers: [ReportExportsController],
  providers: [
    ReportDataQuery,
    RequestReportExportUseCase,
    ListMyExportsUseCase,
    DownloadReportExportUseCase,
    DeleteReportExportUseCase,
    ReportExportProcessor,
    ReportPdfRenderer,
    ReportXlsxRenderer,
    ReportDocxRenderer, // [2026-10-19]: Word
    // [Strategy Registry]: un formato nuevo = una clase nueva añadida aquí | [Principio]: OCP
    {
      provide: REPORT_RENDERERS,
      inject: [ReportPdfRenderer, ReportXlsxRenderer, ReportDocxRenderer],
      useFactory: (...renderers: unknown[]) => renderers,
    },
    // [Sprint 6.7]: prefijo «reports» en el almacén que elige STORAGE_PROVIDER (disco, MinIO o R2), el mismo de Audio y Courses
    {
      provide: REPORTS_STORE,
      useFactory: () => createObjectStore('reports'),
    },
  ],
})
export class ReportsModule {}
