import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import type { TopicCrudService } from '../../../shared/application/topic-crud.service';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  PolyglotDraftBody,
  PolyglotTopicBody,
  UpdatePolyglotTopicBody,
} from '../application/dtos/polyglot.dto';
import { EnrichTermsUseCase } from '../application/use-cases/enrich-terms.use-case';
import { GenerateTopicDraftUseCase } from '../application/use-cases/generate-topic-draft.use-case';
import {
  isPolyglotStaff,
  POLYGLOT_TOPICS,
  PolyglotTopicAccess,
} from '../application/use-cases/get-comparison-table.use-case';
import { PolyglotConcept } from '../domain/entities/polyglot-concept.entity';
import type { PolyglotTopic } from '../domain/entities/polyglot-topic.entity';
// [Controller PolyglotTopics · Sprints 10.5/10.6 · RF-129/RF-132]: temas — listar y ver (publicados para todos; borradores para el personal), crear, editar, publicar y archivar (TEACHER o ADMIN), borrador con IA y obtener el IPA del tema | [Patrón]: Thin Controller + Generic Service (TopicCrudService) | [Principio]: SRP + DRY + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('polyglot')
@ApiBearerAuth()
@Controller('polyglot/topics')
export class PolyglotTopicsController {
  constructor(
    @Inject(POLYGLOT_TOPICS)
    private readonly topics: TopicCrudService<PolyglotTopic>,
    private readonly access: PolyglotTopicAccess,
    private readonly draft: GenerateTopicDraftUseCase,
    private readonly enrich: EnrichTermsUseCase,
    @InjectRepository(PolyglotConcept)
    private readonly concepts: Repository<PolyglotConcept>,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear un tema (nace en borrador)' })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: PolyglotTopicBody) {
    return this.topics.create(u.sub, {
      ...body,
      language: null,
      levels: [],
      status: 'draft',
    });
  }

  @Get()
  @ApiOperation({ summary: 'Temas disponibles (el personal ve también los borradores)' })
  async listAll(@CurrentUser() u: JwtPayload) {
    const all = await this.topics.list({});
    return isPolyglotStaff(actorOf(u))
      ? all
      : all.filter((t) => t.status === 'published');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tema con su número de conceptos y su estado' })
  async getOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const topic = await this.access.readable(actorOf(u), id);
    return { ...topic, concepts: await this.concepts.countBy({ topicId: id }) };
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar el tema o publicarlo tras la revisión' })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePolyglotTopicBody,
  ) {
    return this.topics.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Archivar el tema (borrado lógico)' })
  archiveOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.topics.archive(id);
  }

  @Post(':id/draft')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Borrador con IA: conceptos nuevos en los siete idiomas (sin revisar)',
  })
  draftOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PolyglotDraftBody,
    @Headers('authorization') auth: string,
  ) {
    return this.draft.execute(actorOf(u), id, body, bearer(auth));
  }

  @Post(':id/ipa')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Obtener el IPA de los términos sin IPA (FastAPI)' })
  async ipaOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    await this.access.editable(actorOf(u), id);
    return this.enrich.execute({ topicId: id }, bearer(auth));
  }
}
