import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; // [Multer vía NestJS]: parseo multipart/form-data escribiendo a disco (no en memoria)
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express'; // [Express]: respuesta manual por rangos → el video se puede adelantar
import { sendRanged } from '../../../shared/http/ranged-response'; // [Sprint 6.6]: 200/206/416 compartido con Audio y Reports (DRY)
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'; // [class-validator]: DTO del enlace
import { ApiProperty } from '@nestjs/swagger';
import {
  CourseMaterialsUseCase,
  materialMime,
  type StoredUpload,
} from '../application/use-cases/course-materials.use-case';
// [Controller CourseMaterials]: /courses/:courseId/materials — videos y PDF del curso | [Patrón]: Thin Controller | [Principio]: SRP
// [Seguridad]: JwtAuthGuard global (sesión obligatoria); subir/borrar = ADMIN; la lista blanca de MIME y el límite de tamaño se aplican ANTES de guardar

// [DTO AddLinkMaterial · 2026-10-23]: material externo por URL | [Patrón]: DTO
export class AddLinkMaterialDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=abc' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses/:courseId/materials')
export class CourseMaterialsController {
  constructor(private readonly materials: CourseMaterialsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Materiales (videos/PDF) de un curso' })
  list(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.materials.list(courseId, { id: user.sub, role: user.role }); // Solo si es gratis, comprado o ADMIN
  }

  // `@UseInterceptors(FileInterceptor('file', …))` (NestJS): campo "file" del formulario | `fileFilter`: rechaza MIME no permitidos sin escribir el archivo | el tope de tamaño (MAX_UPLOAD_MB) y la clave UUID los fija CoursesModule (MulterModule)
  @Post()
  @Roles(Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Adjuntar video (MP4/WebM/OGG), PDF o imagen al curso (ADMIN, máx. MAX_UPLOAD_MB, 500 MB por defecto)',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_req, file, cb) =>
        materialMime(file.mimetype, file.originalname)
          ? cb(null, true)
          : cb(
              new BadRequestException(
                `Tipo de archivo no permitido: ${file.mimetype}. Usa video, audio, PDF, imagen o documento (Word/Excel/PowerPoint/TXT).`,
              ),
              false,
            ),
    }),
  )
  upload(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @UploadedFile() file: StoredUpload | undefined,
    @Body('title') title?: string,
  ) {
    return this.materials.upload(courseId, file, title);
  }

  // [POST /courses/:courseId/materials/link · 2026-10-23]: adjunta un enlace externo (YouTube, artículo, podcast…) | [Patrón]: Command
  @Post('link')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Adjuntar un enlace externo como material (ADMIN)' })
  addLink(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: AddLinkMaterialDto,
  ) {
    return this.materials.addLink(courseId, dto.url, dto.title);
  }

  // [Descarga/streaming]: `@Res()` (NestJS) entrega el control a Express | `inline`: el navegador reproduce el video / abre el PDF
  @Get(':id/file')
  @ApiOperation({
    summary:
      'Ver o descargar un material (Range para video; con S3/R2 responde 302 a una URL firmada de corta duración)',
  })
  async file(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    const { material, source } = await this.materials.download(courseId, id, {
      id: user.sub,
      role: user.role,
    }); // 403 si no lo compró
    if (!source) return res.redirect(302, material.url ?? '/'); // [Enlace]: 302 a la URL externa (validada http(s) al guardar)
    // `encodeURIComponent` (JS) + RFC 5987 (filename*): nombres con tildes/espacios sin romper la cabecera
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(material.originalName)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff'); // [Seguridad]: el navegador no reinterpreta el tipo
    await sendRanged(res, range, source); // Content-Type y Content-Length los fija el helper
  }

  // [POST :id/complete]: marca el material como visto en la línea de tiempo del usuario → recalcula su progreso
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar material como completado (usuario inscrito)',
  })
  complete(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.materials.complete(courseId, id, {
      id: user.sub,
      role: user.role,
    });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Quitar un material del curso (ADMIN)' })
  remove(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materials.remove(courseId, id);
  }
}
