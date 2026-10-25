import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { sendRanged } from '../../../shared/http/ranged-response';
import { ALLOWED_PERIOD_MONTHS } from '../../../shared/utils/period.util';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  DeleteReportExportUseCase,
  DownloadReportExportUseCase,
  ListMyExportsUseCase,
} from '../application/use-cases/download-report-export.use-case';
import { RequestReportExportUseCase } from '../application/use-cases/request-report-export.use-case';
import {
  REPORT_FORMATS,
  type ReportFormat,
} from '../domain/entities/report-export.entity';
// [Controller ReportExports · Sprint 6.4]: pedir, listar, descargar y borrar exportaciones del reporte del sistema | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores
// [Seguridad]: solo ADMIN (igual que /admin/reports) · cada usuario solo ve sus exportaciones

// [DTO]: class-validator → 400 si el formato o el periodo no son válidos | [Principio]: Fail Fast
export class RequestReportExportBody {
  @IsIn(REPORT_FORMATS) format!: ReportFormat;
  @IsOptional() @IsIn(ALLOWED_PERIOD_MONTHS) periodMonths?: number;
}

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('reports/export')
export class ReportExportsController {
  constructor(
    private readonly request: RequestReportExportUseCase,
    private readonly listMine: ListMyExportsUseCase,
    private readonly download: DownloadReportExportUseCase,
    private readonly remove: DeleteReportExportUseCase,
  ) {}

  // 202 Accepted: el archivo se genera en segundo plano; el aviso llega por SSE cuando está listo
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicitar la exportación del reporte (PDF o Excel)',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: RequestReportExportBody,
  ) {
    return this.request.execute(
      user.sub,
      body.format,
      body.periodMonths ?? null,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis exportaciones recientes y su estado' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  // `@Res()` (NestJS): respuesta manual → el archivo viaja en flujo desde el disco o redirige (302) a la URL firmada de S3/R2
  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar una exportación lista' })
  async file(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, source } = await this.download.execute(user.sub, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); // `attachment`: el navegador lo descarga
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await sendRanged(res, range, source);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar una exportación y su archivo' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(user.sub, id);
  }
}
