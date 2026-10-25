import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import { Language } from '../../../shared/domain/language.vo';
import { Role } from '../../users/domain/value-objects/role.vo';
import { ArchiveActivityUseCase } from '../application/use-cases/archive-activity.use-case';
import { CreateActivityUseCase } from '../application/use-cases/create-activity.use-case';
import { GenerateActivityDraftUseCase } from '../application/use-cases/generate-activity-draft.use-case';
import { GetActivityUseCase } from '../application/use-cases/get-activity.use-case';
import { ListActivitiesUseCase } from '../application/use-cases/list-activities.use-case';
import { UpdateActivityUseCase } from '../application/use-cases/update-activity.use-case';
import {
  CONTENT_KINDS,
  ITEM_TYPES,
  SKILLS,
  type ContentKind,
  type ItemType,
  type Skill,
} from '../domain/item-type';
// [Controller PracticeActivities · Sprint 8.12 · RF-110/RF-114]: actividades — listar y ver (todos, según rol), crear, borrador con IA, editar/publicar y archivar (TEACHER o ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const actorOf = (u: JwtPayload) => ({ id: u.sub, role: u.role });

export class ItemBody {
  @IsIn(ITEM_TYPES) itemType!: ItemType;
  @IsIn(SKILLS) skill!: Skill;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) prompt!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  options?: string[];
  // `@IsArray({ each })`: lista de listas de texto (variantes aceptadas)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @IsArray({ each: true })
  accepted!: string[][];
  @IsOptional() @IsObject() corrections?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(600) explanation?: string;
  @IsOptional() @IsString() @MaxLength(400) tip?: string;
}

// [ContentBody · 2026-10-23]: contenido vinculado — ruta interna del portal o enlace https (nunca javascript: ni otros esquemas)
export class ContentBody {
  @IsIn(CONTENT_KINDS) kind!: ContentKind;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) label!: string;
  @IsString()
  @MaxLength(600)
  @Matches(/^(\/(?!\/)\S*|https:\/\/\S+)$/, { message: 'href debe ser una ruta interna (/…) o un enlace https' })
  href!: string;
}

export class ActivityBody {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @IsIn(SKILLS) skill!: Skill;
  @IsOptional() @IsBoolean() aiDraft?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemBody)
  items?: ItemBody[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContentBody)
  contents?: ContentBody[];
}

export class UpdateActivityBody extends PartialType(ActivityBody) {
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}

export class DraftBody {
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @IsIn(SKILLS) skill!: Skill;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) topic!: string;
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ITEM_TYPES, { each: true })
  itemTypes!: ItemType[];
  @IsInt() @Min(1) @Max(10) count!: number;
  @IsOptional() @IsString() @MaxLength(20000) sourceText?: string; // [2026-10-23]: texto de un PDF, imagen o enlace
}

@ApiTags('practice')
@ApiBearerAuth()
@Controller('practice/activities')
export class PracticeActivitiesController {
  constructor(
    private readonly create: CreateActivityUseCase,
    private readonly draft: GenerateActivityDraftUseCase,
    private readonly list: ListActivitiesUseCase,
    private readonly get: GetActivityUseCase,
    private readonly update: UpdateActivityUseCase,
    private readonly archive: ArchiveActivityUseCase,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Crear una actividad (a mano o desde un borrador de IA); nace en borrador',
  })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: ActivityBody) {
    return this.create.execute(u.sub, body);
  }

  @Post('draft')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Pedir un borrador de ítems a la IA (no se guarda: lo revisa el docente)',
  })
  draftItems(@Body() body: DraftBody) {
    return this.draft.execute(body);
  }

  @Get()
  @ApiOperation({
    summary:
      'Actividades por idioma, nivel y habilidad (mine=true: las mías, con borradores)',
  })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('skill') skill?: string,
    @Query('mine') mine?: string,
  ) {
    return this.list.execute(actorOf(u), {
      language,
      level,
      skill,
      mine: mine === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Actividad con sus ítems (al estudiante sin respuestas correctas)',
  })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar y publicar la actividad' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateActivityBody,
  ) {
    // Los ítems se editan por /practice/items → solo se pasan los campos de la actividad
    const { title, description, level, skill, status } = body;
    return this.update.execute(actorOf(u), id, {
      title,
      description,
      level,
      skill,
      status,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Archivar la actividad (borrado lógico)' })
  archiveOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.archive.execute(actorOf(u), id);
  }
}
