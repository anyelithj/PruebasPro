import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { GameCatalogUseCase } from '../application/use-cases/game-catalog.use-case';
// [GameCatalogController · 2026-10-24]: /games/catalog — listar (todos) · editar título/descripción y publicar/despublicar (docente/admin) · eliminar = archivar
// [Patrón]: Thin Controller (delegación al caso de uso) + DTO validado (class-validator) | [Principio]: SRP + Least Privilege (@Roles) | [Protocolo]: REST · JSON

export class UpdateGameBody {
  @IsOptional() @IsString() @MaxLength(80) title?: string | null;
  @IsOptional() @IsString() @MaxLength(240) description?: string | null;
  @IsOptional() @IsIn(['published', 'draft']) status?: 'published' | 'draft';
}

const actorOf = (u: JwtPayload) => ({ id: u.sub, role: u.role });

@ApiTags('games')
@ApiBearerAuth()
@Controller('games/catalog')
export class GameCatalogController {
  constructor(private readonly catalog: GameCatalogUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de juegos (familia, habilidad, título/descripción propios, estado) y licencia del contenido' })
  list(@CurrentUser() u: JwtPayload) {
    return this.catalog.list(actorOf(u));
  }

  @Patch(':type')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar título/descripción o publicar/despublicar un juego' })
  update(@CurrentUser() u: JwtPayload, @Param('type') type: string, @Body() body: UpdateGameBody) {
    return this.catalog.update(actorOf(u), type, body);
  }

  @Delete(':type')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar (archivar) un juego del catálogo' })
  remove(@CurrentUser() u: JwtPayload, @Param('type') type: string) {
    return this.catalog.archive(actorOf(u), type);
  }
}
