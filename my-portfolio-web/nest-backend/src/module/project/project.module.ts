// [FACADE] project bounded context — CRUD del portfolio (Nest + Prisma).
import { Module } from '@nestjs/common';
import { ProjectController } from './controller/project.controller';
import { ProjectRepository } from './repository/project.repository';
import { ProjectService } from './service/project.service';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
