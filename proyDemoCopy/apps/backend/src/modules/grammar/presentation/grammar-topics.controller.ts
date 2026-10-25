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
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { In, Repository } from 'typeorm';
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
  GrammarDraftBody,
  GrammarTopicBody,
  UpdateGrammarTopicBody,
} from '../application/dtos/grammar.dto';
import { EnrichExampleUseCase } from '../application/use-cases/enrich-example.use-case';
import { GenerateTopicDraftUseCase } from '../application/use-cases/generate-topic-draft.use-case';
import {
  GetGrammarTopicUseCase,
  GRAMMAR_TOPICS,
  GrammarAccess,
  isGrammarStaff,
} from '../application/use-cases/list-sections.use-case';
import { GrammarExample } from '../domain/entities/grammar-example.entity';
import { GrammarSection } from '../domain/entities/grammar-section.entity';
import type { GrammarTopic } from '../domain/entities/grammar-topic.entity';
// [Controller GrammarTopics · Sprints 10.9/10.10 · RF-133/RF-135]: fichas — listar por idioma y nivel y ver completas (publicadas para todos; borradores para el personal), crear, editar, publicar y archivar (TEACHER o ADMIN), borrador con IA y obtener IPA y traducción de la ficha | [Patrón]: Thin Controller + Generic Service (TopicCrudService) | [Principio]: SRP + DRY + mínimo privilegio | [Paradigma]: POO + Decoradores
// [Orden]: «draft» antes que «:id»

@ApiTags('grammar')
@ApiBearerAuth()
@Controller('grammar/topics')
export class GrammarTopicsController {
  constructor(
    @Inject(GRAMMAR_TOPICS)
    private readonly topics: TopicCrudService<GrammarTopic>,
    private readonly access: GrammarAccess,
    private readonly getTopic: GetGrammarTopicUseCase,
    private readonly draft: GenerateTopicDraftUseCase,
    private readonly enrich: EnrichExampleUseCase,
    @InjectRepository(GrammarSection)
    private readonly sections: Repository<GrammarSection>,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
  ) {}

  @Post('draft')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Borrador de ficha con IA (no se publica sin revisión)' })
  draftOne(
    @CurrentUser() u: JwtPayload,
    @Body() body: GrammarDraftBody,
    @Headers('authorization') auth: string,
  ) {
    return this.draft.execute(actorOf(u), body, bearer(auth));
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear una ficha a mano (nace en borrador)' })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: GrammarTopicBody) {
    return this.topics.create(u.sub, {
      title: body.title,
      language: body.language,
      levels: [body.level],
      summary: body.summary ?? '',
      status: 'draft',
      model: null,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Fichas por idioma y nivel (el personal ve también los borradores; mine=1 solo las propias)' })
  async listAll(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('mine') mine?: string,
  ) {
    const all = await this.topics.list({ language, level });
    const staff = isGrammarStaff(actorOf(u));
    return all.filter(
      (t) =>
        (staff || t.status === 'published') &&
        (mine !== '1' || t.createdBy === u.sub),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa con secciones y ejemplos' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.getTopic.execute(actorOf(u), id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar o publicar la ficha' })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGrammarTopicBody,
  ) {
    const { level, ...rest } = body;
    return this.topics.update(id, { ...rest, ...(level ? { levels: [level] } : {}) });
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Archivar la ficha (borrado lógico)' })
  archiveOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.topics.archive(id);
  }

  @Post(':id/enrich')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Obtener IPA y traducción de los ejemplos sin revisar' })
  async enrichOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    const topic = await this.access.editable(actorOf(u), id);
    const sectionIds = (
      await this.sections.find({ where: { topicId: id }, select: { id: true } })
    ).map((s) => s.id);
    const ids = sectionIds.length
      ? (
          await this.examples.find({
            where: { sectionId: In(sectionIds) },
            select: { id: true },
          })
        ).map((e) => e.id)
      : [];
    return this.enrich.execute(ids, topic.language ?? 'en', bearer(auth));
  }
}
