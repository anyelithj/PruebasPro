import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  GetJobUseCase,
  ListJobsUseCase,
} from '../application/use-cases/list-jobs.use-case';
import { RunJobUseCase } from '../application/use-cases/run-job.use-case';
// [Controller ScheduledJobs · Sprint 7.18 · RF-81]: panel de trabajos (ADMIN) — colas, programados, recientes, detalle y «ejecutar ahora» | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (`@Roles(ADMIN)` en la clase) | [Paradigma]: POO + Decoradores

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/jobs')
export class ScheduledJobsController {
  constructor(
    private readonly list: ListJobsUseCase,
    private readonly get: GetJobUseCase,
    private readonly run: RunJobUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Colas Bull, trabajos programados y últimos trabajos de mantenimiento',
  })
  findAll() {
    return this.list.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un trabajo de mantenimiento' })
  findOne(@Param('id') id: string) {
    return this.get.execute(id);
  }

  @Post(':name/run')
  @ApiOperation({ summary: 'Ejecutar ahora un trabajo programado' })
  runOne(@Param('name') name: string) {
    return this.run.execute(name);
  }
}
