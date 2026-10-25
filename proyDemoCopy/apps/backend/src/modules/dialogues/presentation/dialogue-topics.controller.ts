import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TopicCrudService } from '../../../shared/application/topic-crud.service';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { TopicBody, UpdateTopicBody } from '../application/dtos/dialogue.dto';
import { DIALOGUE_TOPICS } from '../application/use-cases/start-dialogue-session.use-case';
import type { DialogueTopic } from '../domain/entities/dialogue-topic.entity';
// [Controller DialogueTopics · Sprint 9.3 · RF-121]: temas de conversación — listar y ver (todos), crear, editar y archivar (TEACHER o ADMIN) sobre el TopicCrudService genérico | [Patrón]: Thin Controller | [Principio]: SRP + DRY + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('dialogues')
@ApiBearerAuth()
@Controller('dialogues/topics')
export class DialogueTopicsController {
  constructor(
    @Inject(DIALOGUE_TOPICS)
    private readonly topics: TopicCrudService<DialogueTopic>,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear un tema con objetivos y vocabulario clave' })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: TopicBody) {
    return this.topics.create(u.sub, {
      ...body,
      language: body.language ?? null,
      levels: body.levels ?? [],
      objectives: body.objectives ?? [],
      vocabulary: body.vocabulary ?? {},
    });
  }

  @Get()
  @ApiOperation({ summary: 'Temas disponibles por idioma y nivel' })
  listAll(
    @Query('language') language?: string,
    @Query('level') level?: string,
  ) {
    return this.topics.list({ language, level });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tema con sus objetivos y vocabulario clave' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.topics.get(id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar el tema' })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTopicBody,
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
}
