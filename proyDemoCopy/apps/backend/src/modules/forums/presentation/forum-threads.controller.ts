import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CreateThreadUseCase } from '../application/use-cases/create-thread.use-case';
import {
  GetThreadUseCase,
  ListThreadsUseCase,
} from '../application/use-cases/list-threads.use-case';
import { ModerateThreadUseCase } from '../application/use-cases/moderate-thread.use-case';
import type { ThreadStatus } from '../domain/entities/forum-thread.entity';
// [Controller ForumThreads · Sprint 7.14 · RF-72]: hilos por lección — crear, listar, ver, moderar y retirar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (la política vive en los casos de uso) | [Paradigma]: POO + Decoradores

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const actor = (u: JwtPayload) => ({ id: u.sub, role: u.role });

export class CreateThreadBody {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(160) title!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(5000) body!: string;
}

export class ModerateThreadBody {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsIn(['open', 'closed']) status?: ThreadStatus;
}

@ApiTags('forums')
@ApiBearerAuth()
@Controller('forums')
export class ForumThreadsController {
  constructor(
    private readonly create: CreateThreadUseCase,
    private readonly list: ListThreadsUseCase,
    private readonly get: GetThreadUseCase,
    private readonly moderate: ModerateThreadUseCase,
  ) {}

  @Post('lessons/:lessonId/threads')
  @ApiOperation({ summary: 'Abrir un hilo en una lección' })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() body: CreateThreadBody,
  ) {
    return this.create.execute(lessonId, actor(u), body);
  }

  @Get('lessons/:lessonId/threads')
  @ApiOperation({ summary: 'Hilos de una lección (fijados primero)' })
  findAll(
    @CurrentUser() u: JwtPayload,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.list.execute(lessonId, actor(u));
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Un hilo' })
  findOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.get.execute(id, actor(u));
  }

  @Patch('threads/:id')
  @ApiOperation({
    summary: 'Editar (autor) o fijar/cerrar (docente o administrador)',
  })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ModerateThreadBody,
  ) {
    return this.moderate.execute(id, actor(u), body);
  }

  @Delete('threads/:id')
  @ApiOperation({
    summary: 'Retirar un hilo (autor o moderador; borrado lógico)',
  })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.moderate.remove(id, actor(u));
  }
}
