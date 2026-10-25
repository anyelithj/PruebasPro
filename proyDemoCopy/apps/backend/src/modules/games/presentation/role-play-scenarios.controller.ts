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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
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
import { ArchiveScenarioUseCase } from '../application/use-cases/archive-scenario.use-case';
import { CreateScenarioUseCase } from '../application/use-cases/create-scenario.use-case';
import {
  GetScenarioUseCase,
  ListScenariosUseCase,
} from '../application/use-cases/list-scenarios.use-case';
import { UpdateScenarioUseCase } from '../application/use-cases/update-scenario.use-case';
// [Controller RolePlayScenarios · Sprint 8.5 · RF-101]: escenarios de role-play — listar y ver (todos), crear, editar y archivar (TEACHER o ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

export class ObjectiveBody {
  @IsString() @MinLength(1) @MaxLength(40) id!: string;
  @IsString() @MinLength(3) @MaxLength(160) text!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keywords!: string[];
}

export class ScenarioBody {
  @IsString() @MinLength(3) @MaxLength(120) title!: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
  @IsOptional() @IsString() @MaxLength(16) emoji?: string;
  @IsString() @MinLength(3) @MaxLength(120) role!: string;
  @IsOptional() @IsString() @MaxLength(400) opening?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ObjectiveBody)
  objectives!: ObjectiveBody[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  vocabulary?: string[];
}

export class UpdateScenarioBody extends PartialType(ScenarioBody) {} // `PartialType` (@nestjs/swagger): todos opcionales (PATCH)

@ApiTags('games')
@ApiBearerAuth()
@Controller('games/scenarios')
export class RolePlayScenariosController {
  constructor(
    private readonly create: CreateScenarioUseCase,
    private readonly list: ListScenariosUseCase,
    private readonly get: GetScenarioUseCase,
    private readonly update: UpdateScenarioUseCase,
    private readonly archive: ArchiveScenarioUseCase,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear un escenario (docente o ADMIN)' })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: ScenarioBody) {
    return this.create.execute(u.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Escenarios por idioma y nivel' })
  listAll(
    @Query('language') language?: string,
    @Query('level') level?: string,
  ) {
    return this.list.execute({ language, level });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Escenario con objetivos y vocabulario' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar un escenario' })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateScenarioBody,
  ) {
    return this.update.execute(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Archivar un escenario (borrado lógico)' })
  archiveOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.archive.execute(id);
  }
}
