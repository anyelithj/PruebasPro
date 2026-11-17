import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; // Multer vía NestJS: multipart → archivo en memoria (máx. 30 MB)
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { sendRanged } from '../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../shared/storage/object-store';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  isAllowedMime,
  MAX_PRONUNCIATION_MEDIA_BYTES,
  mimeOfKey,
  newMediaKey,
} from '../domain/pronunciation-media';
// [PronunciationMediaController · 2026-11-14]: imagen o video de la boca para «Cómo se pronuncia» (fichas de pronunciación)
// POST /pronunciation-media (docente o admin) → { key } que el editor guarda en `content.mouthMedia` · GET /pronunciation-media/:key → Range/206 (video adelantable)
// [Patrón]: Controller delgado + Adapter (ObjectStore compartido: disco, MinIO o R2 según STORAGE_PROVIDER) | [Principio]: DRY (reutiliza createObjectStore y sendRanged) + Least Privilege
// [Seguridad]: lista blanca de MIME, tope de tamaño durante la subida, clave validada antes de abrir el almacén (sin rutas inyectadas), GET con sesión (guard JWT global)

export const PRONUNCIATION_MEDIA_STORE = Symbol('PRONUNCIATION_MEDIA_STORE'); // `Symbol` (ES2015): token de inyección

// [Archivo subido]: solo lo que se usa de Express.Multer.File (ISP)
interface UploadedMedia {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags('curriculum')
@ApiBearerAuth()
@Controller('pronunciation-media')
export class PronunciationMediaController {
  constructor(@Inject(PRONUNCIATION_MEDIA_STORE) private readonly store: ObjectStore) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir imagen o video de la boca para «Cómo se pronuncia» (PNG/JPEG/WEBP/GIF/MP4/WEBM, máx. 30 MB)' })
  // `fileFilter`: rechaza el tipo ANTES de leer el archivo · `limits.fileSize`: corta la subida al pasar el tope
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PRONUNCIATION_MEDIA_BYTES },
      fileFilter: (_req, file, cb) =>
        isAllowedMime(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('Usa una imagen (PNG, JPEG, WEBP o GIF) o un video (MP4 o WEBM).'), false),
    }),
  )
  async upload(@UploadedFile() file: UploadedMedia | undefined): Promise<{ key: string; type: 'image' | 'video' }> {
    if (!file || !isAllowedMime(file.mimetype)) throw new BadRequestException('Adjunta una imagen o un video.');
    const key = newMediaKey(file.mimetype);
    await this.store.put(key, file.buffer, file.mimetype);
    return { key, type: file.mimetype.startsWith('video/') ? 'video' : 'image' };
  }

  @Get(':key')
  @ApiOperation({ summary: 'Imagen o video de la boca (Range/206 o 302 a URL firmada)' })
  async serve(
    @Param('key') key: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const mime = mimeOfKey(key);
    const size = mime ? await this.store.size(key) : null;
    if (!mime || size === null) throw new NotFoundException('Archivo no encontrado');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // La clave nunca cambia de contenido → caché larga en el navegador
    await sendRanged(res, range, {
      size,
      contentType: mime,
      open: (r) => this.store.open(key, r),
      signedUrl: await this.store.signedUrl(key, { filename: key, contentType: mime, disposition: 'inline' }),
    });
  }
}
