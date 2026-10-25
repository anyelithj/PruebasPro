import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  CreateFaqDto,
  ListFaqsQuery,
  UpdateFaqDto,
} from '../application/dtos/faq.dto';
import { CreateFaqUseCase } from '../application/use-cases/create-faq.use-case';
import {
  GetFaqUseCase,
  ListFaqsUseCase,
} from '../application/use-cases/list-faqs.use-case';
import {
  ArchiveFaqUseCase,
  UpdateFaqUseCase,
} from '../application/use-cases/update-faq.use-case';
// [Controller Faqs · Sprint 7.10 · RF-94/97]: FAQ públicas (leer y buscar) y gestión ADMIN (crear, editar, archivar) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (@Public solo en lectura; escribir exige ADMIN) | [Paradigma]: POO + Decoradores

@ApiTags('help')
@Controller('help/faqs')
export class FaqsController {
  constructor(
    private readonly create: CreateFaqUseCase,
    private readonly list: ListFaqsUseCase,
    private readonly get: GetFaqUseCase,
    private readonly update: UpdateFaqUseCase,
    private readonly archive: ArchiveFaqUseCase,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'FAQ publicadas (búsqueda y filtros por categoría, rol e idioma)',
  })
  findAll(@Query() q: ListFaqsQuery) {
    return this.list.execute(q);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Una FAQ publicada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear FAQ (ADMIN) y reindexar el Agente Guía' })
  createOne(@Body() dto: CreateFaqDto, @Headers('authorization') auth: string) {
    return this.create.execute(dto, bearer(auth));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar FAQ (ADMIN)' })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
    @Headers('authorization') auth: string,
  ) {
    return this.update.execute(id, dto, bearer(auth));
  }

  // [DELETE = archivar]: borrado lógico (status archived) → la FAQ deja de verse y de citarse, pero no se pierde
  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archivar FAQ (ADMIN)' })
  archiveOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    return this.archive.execute(id, bearer(auth));
  }
}
