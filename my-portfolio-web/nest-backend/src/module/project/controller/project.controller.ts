// [MVC-C][SRP] capa HTTP de proyectos — GET públicos, mutaciones solo admin
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { idParamSchema } from 'src/common/dto/id-param.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { createProjectSchema, CreateProjectDto } from '../dto/create-project.dto';
import { updateProjectSchema, UpdateProjectDto } from '../dto/update-project.dto';
import { ProjectService } from '../service/project.service';
import { PROJECT_ROUTES } from '../route/project.routes';

@Controller(PROJECT_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @Public()
  list() {
    return this.projectService.list();
  }

  @Get(PROJECT_ROUTES.BY_ID)
  @Public()
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.projectService.getById(params.id);
  }

  @Post()
  @Roles(ROLE_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Patch(PROJECT_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.projectService.update(params.id, dto);
  }

  @Delete(PROJECT_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    await this.projectService.delete(params.id);
    return { success: true, data: null, message: 'Project deleted' };
  }
}
