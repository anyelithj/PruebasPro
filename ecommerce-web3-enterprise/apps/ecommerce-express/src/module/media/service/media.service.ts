// media.service.ts => casos de uso de medios: subir, listar, actualizar, borrar uno y borrar en lote.
// Capa de negocio entre controller (HTTP) y repository (almacenamiento): N-Layer, SRP.
import { mediaRepository, type MediaRepository } from "../repository/media.repository";
import { normalizeTags, WATERMARK_TAG, type MediaAsset, type MediaFolder, type MediaResourceType } from "../model/media.model";
import type { MediaPageDto, UploadedImageDto } from "../dto/media.dto";
import type { ListMediaQuery } from "../schema/media.schema";
import { InappropriateImageException, NoFilesException, NothingToUpdateException } from "../exception/media.exception";
import { inspectImage } from "../util/vision.util";

// INSPECTED_FOLDERS => RF-06.6 carpetas públicas del catálogo cuyas fotos pasan por calidad + moderación de IA
const INSPECTED_FOLDERS: ReadonlySet<MediaFolder> = new Set(["products", "brands", "collections", "reviews"]);

export class MediaService {
  // Inyección por constructor (DIP): en tests se pasa un repositorio falso sin tocar Cloudinary
  constructor(private readonly repository: MediaRepository = mediaRepository) {}

  // uploadImages => "Promise.all" sube en paralelo: N imágenes tardan lo que la más lenta, no la suma
  // RF-06.6: en carpetas públicas cada foto se inspecciona ANTES de subirla: contenido no apto => 422 y no se publica
  // ninguna del lote; la calidad (borrosa, oscura, baja resolución) viaja en la respuesta como aviso
  public async uploadImages(buffers: Buffer[], folder: MediaFolder, options: { tags?: string[]; watermark?: boolean } = {}): Promise<UploadedImageDto[]> {
    if (buffers.length === 0) throw new NoFilesException();
    const inspections = INSPECTED_FOLDERS.has(folder) ? await Promise.all(buffers.map((buffer) => inspectImage(buffer))) : [];
    const blocked = inspections.find((inspection) => inspection?.moderation.flagged);
    if (blocked) throw new InappropriateImageException(blocked.moderation.category ?? "unknown");
    const saveOptions = { tags: normalizeTags(options.tags ?? []), watermark: options.watermark ?? false }; // RF-26.1 / 26.5
    return Promise.all(buffers.map(async (buffer, index) => ({ ...(await this.repository.save(buffer, folder, saveOptions)), quality: inspections[index]?.quality })));
  }

  // uploadVideos => RF-26.7 videos (sin inspección de IA: CLIP analiza imágenes); Cloudinary genera MP4/WebM y portada
  public async uploadVideos(buffers: Buffer[], folder: MediaFolder, tags: string[] = []): Promise<MediaAsset[]> {
    if (buffers.length === 0) throw new NoFilesException();
    return Promise.all(buffers.map((buffer) => this.repository.saveVideo(buffer, folder, { tags: normalizeTags(tags) })));
  }

  // updateMeta => RF-26.1 / 26.5 / 26.7 título, descripción, alt, etiquetas y marca de agua (etiqueta especial)
  public async updateMeta(publicId: string, meta: { type: MediaResourceType; alt?: string | undefined; title?: string | undefined; description?: string | undefined; tags?: string[] | undefined; watermark?: boolean | undefined }): Promise<MediaAsset> {
    let tags = meta.tags ? normalizeTags(meta.tags) : undefined;
    if (meta.watermark !== undefined) {
      const current = tags ?? [...((await this.repository.findById(publicId, meta.type))?.tags ?? [])];
      tags = meta.watermark ? [...current, WATERMARK_TAG] : current.filter((tag) => tag !== WATERMARK_TAG);
    }
    return this.repository.updateMeta(publicId, meta.type, { alt: meta.alt, title: meta.title, description: meta.description, tags });
  }

  public tags(type: MediaResourceType) {
    return this.repository.tags(type);
  }

  // listImages => página del administrador de medios (paginación por cursor)
  public listImages({ folder, cursor, limit, q, tag, type }: ListMediaQuery): Promise<MediaPageDto> {
    return this.repository.search({ folder, q, tag, type }, cursor, limit); // RF-26.1 búsqueda + filtros
  }

  // updateImage => regla de negocio: el PATCH debe traer algo que cambiar (archivo nuevo y/o texto alternativo)
  public async updateImage(publicId: string, buffer: Buffer | undefined, alt: string | undefined): Promise<MediaAsset> {
    if (!buffer && !alt) throw new NothingToUpdateException();
    return this.repository.replace(publicId, buffer, alt);
  }

  // deleteImage => lo usan otros módulos al reemplazar un logo o una imagen (service -> service, sin saltar capas)
  public deleteImage(publicId: string): Promise<void> {
    return this.repository.remove(publicId);
  }

  // deleteImages => borrado en lote desde el administrador de medios
  public deleteImages(publicIds: readonly string[]): Promise<void> {
    return this.repository.removeMany(publicIds);
  }
}

export const mediaService = new MediaService();
