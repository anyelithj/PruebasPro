import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';
import { Role } from '../../../users/domain/value-objects/role.vo';
import {
  CourseMaterial,
  CourseMaterialKind,
} from '../../domain/entities/course-material.entity';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../domain/interfaces/file-storage.interface';
import type { RangedSource } from '../../../../shared/http/ranged-response';
// [Casos de uso de materiales]: subir, listar, obtener y borrar videos/PDF de un curso | [Patrón]: Use Case + Port/Adapter (FileStorage) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await

// [Tipos MIME admitidos → tipo de material]: lista blanca (nunca se acepta ejecutable ni HTML) | [Seguridad] | [Patrón]: Lookup Table
export const MATERIAL_MIME: Readonly<Record<string, CourseMaterialKind>> = {
  'video/mp4': CourseMaterialKind.VIDEO,
  'video/webm': CourseMaterialKind.VIDEO,
  'video/ogg': CourseMaterialKind.VIDEO,
  'application/pdf': CourseMaterialKind.PDF,
  'image/png': CourseMaterialKind.IMAGE,
  'image/jpeg': CourseMaterialKind.IMAGE,
  'image/webp': CourseMaterialKind.IMAGE,
  'image/gif': CourseMaterialKind.IMAGE, // [Seguridad]: SVG excluido a propósito (puede llevar scripts)
  // [2026-10-23]: audio y documentos de estudio | [Seguridad]: sin HTML ni ejecutables; se sirven con nosniff
  'audio/mpeg': CourseMaterialKind.AUDIO,
  'audio/wav': CourseMaterialKind.AUDIO,
  'audio/x-wav': CourseMaterialKind.AUDIO,
  'audio/mp4': CourseMaterialKind.AUDIO,
  'audio/x-m4a': CourseMaterialKind.AUDIO,
  'audio/ogg': CourseMaterialKind.AUDIO,
  'audio/webm': CourseMaterialKind.AUDIO,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    CourseMaterialKind.DOCUMENT,
  'application/msword': CourseMaterialKind.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    CourseMaterialKind.DOCUMENT,
  'application/vnd.ms-excel': CourseMaterialKind.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    CourseMaterialKind.DOCUMENT,
  'text/plain': CourseMaterialKind.DOCUMENT,
  'text/markdown': CourseMaterialKind.DOCUMENT,
  'text/csv': CourseMaterialKind.DOCUMENT,
};
// [Extensión → MIME]: algunos navegadores/SO envían el PDF o el video como "application/octet-stream" o sin tipo → se deduce por la extensión (la lista blanca sigue mandando) | [Patrón]: Lookup Table
const EXT_MIME: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  weba: 'audio/webm',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
};

// [materialMime]: MIME canónico admitido o undefined | `split('.').pop()` (ES5): extensión final | [Paradigma]: Funcional (pura)
export function materialMime(
  mimetype: string,
  originalname: string,
): string | undefined {
  if (MATERIAL_MIME[mimetype]) return mimetype;
  return EXT_MIME[originalname.split('.').pop()?.toLowerCase() ?? ''];
}

// [Quién pide el material]: id + rol del JWT (la capa de aplicación no conoce JWT) | [Principio]: ISP
export interface MaterialViewer {
  id: string;
  role: Role;
}

// `export interface` (TS): datos del archivo ya escrito en disco por multer (evita depender de @types/multer) | [Principio]: ISP
export interface StoredUpload {
  filename: string; // Nombre aleatorio de 128 bits asignado por multer = storageKey
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class CourseMaterialsUseCase {
  constructor(
    @InjectRepository(CourseMaterial)
    private readonly materials: Repository<CourseMaterial>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollments: Repository<CourseEnrollment>,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  // [Control de acceso]: ADMIN siempre; resto solo si compró el curso o se inscribió (gratis) | [Seguridad]: se aplica en listar, descargar y completar (la URL del archivo no basta)
  async assertAccess(
    courseId: string,
    viewer: MaterialViewer,
  ): Promise<CourseEnrollment | null> {
    if (viewer.role === Role.ADMIN)
      return this.enrollments.findOne({
        where: { userId: viewer.id, courseId },
      });
    if (!(await this.courses.exists({ where: { id: courseId } })))
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
    const enrollment = await this.enrollments.findOne({
      where: { userId: viewer.id, courseId },
    });
    if (!enrollment?.purchasedAt)
      throw new ForbiddenException(
        'Compra o inscríbete en el curso para ver su material',
      );
    return enrollment;
  }

  // [Marcar completado]: añade el material a la línea de tiempo del usuario y recalcula el progreso (0..100) | idempotente | [Patrón]: Command
  async complete(
    courseId: string,
    id: string,
    viewer: MaterialViewer,
  ): Promise<{ completedMaterialIds: string[]; progress: number }> {
    const enrollment = await this.assertAccess(courseId, viewer);
    if (!enrollment)
      throw new ForbiddenException(
        'Inscríbete en el curso para registrar tu progreso',
      ); // ADMIN sin matrícula
    const all = await this.materials.find({
      where: { courseId },
      select: { id: true },
    });
    if (!all.some((m) => m.id === id))
      throw new NotFoundException('Material no encontrado');
    const valid = new Set(all.map((m) => m.id)); // `Set` (ES2015): descarta ids de materiales ya borrados
    const done = [
      ...new Set([...(enrollment.completedMaterialIds ?? []), id]),
    ].filter((x) => valid.has(x));
    enrollment.completedMaterialIds = done;
    enrollment.progress = Math.round((done.length / all.length) * 100);
    enrollment.completedAt =
      enrollment.progress === 100
        ? (enrollment.completedAt ?? new Date())
        : null;
    await this.enrollments.save(enrollment);
    return { completedMaterialIds: done, progress: enrollment.progress };
  }

  // [Listar]: orden estable (posición y fecha) — tras comprobar el acceso
  async list(
    courseId: string,
    viewer: MaterialViewer,
  ): Promise<CourseMaterial[]> {
    await this.assertAccess(courseId, viewer);
    return this.materials.find({
      where: { courseId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  // [Subir]: el archivo YA está en disco; si algo falla, se borra para no dejar huérfanos | [Patrón]: Compensating Action
  async upload(
    courseId: string,
    file: StoredUpload | undefined,
    title: string | undefined,
  ): Promise<CourseMaterial> {
    if (!file)
      throw new BadRequestException(
        'Adjunta un video (MP4/WebM), un PDF o una imagen',
      );
    try {
      const mimeType = materialMime(file.mimetype, file.originalname); // Tipo real aunque el navegador no lo envíe
      const kind = mimeType ? MATERIAL_MIME[mimeType] : undefined;
      if (!mimeType || !kind)
        throw new BadRequestException(
          `Tipo de archivo no permitido: ${file.mimetype}`,
        );
      if (!(await this.courses.exists({ where: { id: courseId } })))
        throw new NotFoundException(`Curso ${courseId} no encontrado`);
      const position = await this.materials.count({ where: { courseId } }); // Al final de la lista
      await this.storage.commit(file.filename, mimeType); // [Sprint 6.7]: disco local (no-op) o bucket S3 (MinIO/R2)
      return await this.materials.save(
        this.materials.create({
          courseId,
          kind,
          title: (title?.trim() || file.originalname).slice(0, 200), // Sin título → nombre del archivo
          storageKey: file.filename,
          originalName: file.originalname.slice(0, 255),
          mimeType,
          sizeBytes: file.size,
          position,
        }),
      );
    } catch (err) {
      await this.storage.remove(file.filename); // Compensación: no queda el binario sin metadatos
      throw err;
    }
  }

  // [Adjuntar enlace · 2026-10-23]: material externo por URL (sin binario) | [Seguridad]: solo http(s) → nunca javascript:/data:
  async addLink(
    courseId: string,
    url: string,
    title: string | undefined,
  ): Promise<CourseMaterial> {
    let parsed: URL;
    try {
      parsed = new URL(url.trim()); // `URL` (WHATWG): valida y normaliza
    } catch {
      throw new BadRequestException('URL no válida');
    }
    if (!/^https?:$/.test(parsed.protocol))
      throw new BadRequestException('Solo se admiten enlaces http(s)');
    if (!(await this.courses.exists({ where: { id: courseId } })))
      throw new NotFoundException(`Curso ${courseId} no encontrado`);
    const position = await this.materials.count({ where: { courseId } });
    return this.materials.save(
      this.materials.create({
        courseId,
        kind: CourseMaterialKind.LINK,
        title: (title?.trim() || parsed.hostname).slice(0, 200),
        url: parsed.href.slice(0, 2000),
        storageKey: '', // Sin binario
        originalName: parsed.hostname.slice(0, 255),
        mimeType: 'text/uri-list', // RFC 2483
        sizeBytes: 0,
        position,
      }),
    );
  }

  // [Obtener para descarga]: comprueba el acceso y devuelve metadatos + fuente por rangos o URL firmada (disco o S3, al controlador le da igual) | [Principio]: DIP
  async download(
    courseId: string,
    id: string,
    viewer: MaterialViewer,
  ): Promise<{ material: CourseMaterial; source: RangedSource | null }> {
    await this.assertAccess(courseId, viewer);
    const material = await this.file(courseId, id);
    if (material.kind === CourseMaterialKind.LINK)
      return { material, source: null }; // [Enlace]: el controlador redirige a la URL externa
    return {
      material,
      source: {
        size: Number(material.sizeBytes), // Tamaño guardado al subir → sin consultar el almacén
        contentType: material.mimeType,
        open: (range) => this.storage.open(material.storageKey, range),
        // [Sprint 6.7]: con S3/R2 el navegador descarga directo del bucket (null en disco local → streaming por el backend)
        signedUrl: await this.storage.signedUrl(material.storageKey, {
          filename: material.originalName,
          contentType: material.mimeType,
          disposition: 'inline',
        }),
      },
    };
  }

  // [Metadatos]: uso interno (borrar) y tras el control de acceso
  async file(courseId: string, id: string): Promise<CourseMaterial> {
    const material = await this.materials.findOne({ where: { id, courseId } });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  // [Borrar todos]: al eliminar el curso (FK suave → no hay CASCADE en BD) | filas primero, binarios después
  async removeAll(courseId: string): Promise<void> {
    const all = await this.materials.find({
      where: { courseId },
      select: { id: true, storageKey: true },
    });
    await this.materials.delete({ courseId });
    await Promise.all(
      all
        .filter((m) => m.storageKey) // Enlaces: sin binario
        .map((m) => this.storage.remove(m.storageKey)),
    ); // `Promise.all` (ES2015): borrado en paralelo
  }

  // [Borrar]: metadatos y binario
  async remove(courseId: string, id: string): Promise<{ deleted: true }> {
    const material = await this.file(courseId, id);
    await this.materials.delete(material.id);
    if (material.storageKey) await this.storage.remove(material.storageKey); // Enlaces: sin binario
    return { deleted: true };
  }
}
