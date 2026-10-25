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
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CreatePostUseCase } from '../application/use-cases/create-post.use-case';
import { EditPostUseCase } from '../application/use-cases/edit-post.use-case';
import {
  GetPostUseCase,
  ListPostsUseCase,
} from '../application/use-cases/list-posts.use-case';
// [Controller ForumPosts · Sprint 7.14 · RF-72]: respuestas — crear, listar (con el hilo), ver, editar y retirar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores
// [Anti-spam]: 20 respuestas por minuto y usuario/IP

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const actor = (u: JwtPayload) => ({ id: u.sub, role: u.role });

export class PostBody {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

@ApiTags('forums')
@ApiBearerAuth()
@Controller('forums')
export class ForumPostsController {
  constructor(
    private readonly create: CreatePostUseCase,
    private readonly list: ListPostsUseCase,
    private readonly get: GetPostUseCase,
    private readonly edit: EditPostUseCase,
  ) {}

  @Post('threads/:id/posts')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Responder a un hilo abierto (avisa al autor del hilo)',
  })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostBody,
  ) {
    return this.create.execute(id, actor(u), dto.body);
  }

  @Get('threads/:id/posts')
  @ApiOperation({ summary: 'Respuestas del hilo en orden cronológico' })
  findAll(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.list.execute(id, actor(u));
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Una respuesta' })
  findOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.get.execute(id, actor(u));
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Editar mi respuesta' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostBody,
  ) {
    return this.edit.execute(id, actor(u), dto.body);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Retirar una respuesta (autor o moderador)' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.edit.remove(id, actor(u));
  }
}
