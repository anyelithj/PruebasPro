// media.repository.ts => acceso al almacenamiento de archivos (Cloudinary). Patrón Repository + Adapter:
// el resto del sistema pide "guardar/buscar/actualizar/borrar un asset" sin conocer el SDK; cambiar de proveedor
// (S3, MinIO) solo toca esta clase (DIP: el service depende de este contrato, no de Cloudinary).
// RF-26.1 búsqueda por texto/etiqueta (Search API) · RF-26.5 marca de agua en la entrega · RF-26.7 videos con
// transformaciones (MP4/WebM 720p + portada) y metadatos (título, descripción, etiquetas).
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { getCloudinary } from "../../../config/cloudinary.config";
import { appConfig } from "../../../config/app.config";
import { MEDIA_ROOT, WATERMARK_TAG, searchExpression, type MediaAsset, type MediaFolder, type MediaResourceType } from "../model/media.model";
import type { MediaPageDto } from "../dto/media.dto";
import { MediaProviderException, MediaUploadFailedException } from "../exception/media.exception";

// Forma mínima común de un recurso de Cloudinary (respuesta de upload, explicit, search y Admin API)
interface CloudinaryResource {
  public_id: string;
  width: number;
  height: number;
  resource_type?: string;
  format?: string;
  bytes?: number;
  created_at?: string;
  duration?: number;
  tags?: string[];
  context?: { custom?: Record<string, string> } | Record<string, string>; // "custom" en Admin API; plano en Search API
}

export interface SaveOptions {
  tags?: readonly string[] | undefined;
  watermark?: boolean | undefined;
}

// VIDEO_EAGER => versiones generadas en segundo plano al subir un video (entrega instantánea después)
const VIDEO_EAGER = [
  { width: 1280, height: 720, crop: "limit", format: "mp4", video_codec: "h264", quality: "auto" },
  { width: 1280, height: 720, crop: "limit", format: "webm", quality: "auto" },
];

export class MediaRepository {
  // save => sube un Buffer nuevo a la carpeta (imagen); "watermark" agrega la etiqueta que activa la marca de agua
  public save(buffer: Buffer, folder: MediaFolder, options: SaveOptions = {}): Promise<MediaAsset> {
    return this.upload(buffer, { folder: `${MEDIA_ROOT}/${folder}`, tags: this.tagsFor(options) }, "image");
  }

  // saveVideo => RF-26.7 sube un video y genera sus versiones MP4/WebM (eager asíncrono: no bloquea la petición)
  public saveVideo(buffer: Buffer, folder: MediaFolder, options: SaveOptions = {}): Promise<MediaAsset> {
    return this.upload(buffer, { folder: `${MEDIA_ROOT}/${folder}`, tags: this.tagsFor(options), eager: VIDEO_EAGER, eager_async: true }, "video");
  }

  // search => RF-26.1 biblioteca con búsqueda: carpeta, etiqueta, texto y tipo (Search API con paginación por cursor)
  public async search(filters: { folder?: MediaFolder | undefined; tag?: string | undefined; q?: string | undefined; type?: MediaResourceType | undefined }, cursor: string | undefined, limit: number): Promise<MediaPageDto> {
    let query = getCloudinary().search.expression(searchExpression(filters)).sort_by("created_at", "desc").with_field("tags").with_field("context").max_results(limit);
    if (cursor) query = query.next_cursor(cursor);
    const page = (await query.execute().catch(() => {
      throw new MediaProviderException();
    })) as { resources: CloudinaryResource[]; next_cursor?: string };
    return { items: page.resources.map((resource) => this.toAsset(resource)), nextCursor: page.next_cursor ?? null };
  }

  // tags => RF-26.1 etiquetas usadas en el proyecto (para el filtro de la biblioteca)
  public async tags(type: MediaResourceType = "image"): Promise<string[]> {
    const result = (await getCloudinary().api.tags({ resource_type: type, prefix: "", max_results: 500 }).catch(() => ({ tags: [] }))) as { tags: string[] };
    return result.tags;
  }

  // replace => PATCH: reemplaza el archivo conservando su public_id (las URLs guardadas siguen válidas)
  // y/o actualiza el texto alternativo. "invalidate: true" purga la caché del CDN para servir la versión nueva.
  public async replace(publicId: string, buffer: Buffer | undefined, alt: string | undefined): Promise<MediaAsset> {
    const context = alt ? { context: { alt } } : {};
    if (buffer) return this.upload(buffer, { public_id: publicId, overwrite: true, invalidate: true, ...context }, "image");
    const result = await getCloudinary()
      .uploader.explicit(publicId, { type: "upload", ...context })
      .catch(() => {
        throw new MediaProviderException();
      });
    return this.toAsset(result as CloudinaryResource);
  }

  // updateMeta => RF-26.1 / 26.7 metadatos sin volver a subir: etiquetas (reemplazo completo) y contexto
  // (alt, título, descripción). Admin API "update" sirve para imágenes y videos
  public async updateMeta(publicId: string, type: MediaResourceType, meta: { alt?: string | undefined; title?: string | undefined; description?: string | undefined; tags?: readonly string[] | undefined }): Promise<MediaAsset> {
    const context = Object.entries({ alt: meta.alt, title: meta.title, description: meta.description })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value).replace(/[|=]/g, " ")}`) // "|" y "=" separan pares en Cloudinary
      .join("|");
    const result = await getCloudinary()
      .api.update(publicId, { resource_type: type, ...(context ? { context } : {}), ...(meta.tags ? { tags: [...meta.tags] } : {}) })
      .catch(() => {
        throw new MediaProviderException();
      });
    return this.toAsset(result as CloudinaryResource);
  }

  // findById => recurso completo (para respaldo y uso)
  public async findById(publicId: string, type: MediaResourceType = "image"): Promise<(MediaAsset & { originalUrl: string }) | null> {
    const resource = (await getCloudinary().api.resource(publicId, { resource_type: type, context: true, tags: true }).catch(() => null)) as (CloudinaryResource & { secure_url: string }) | null;
    return resource ? { ...this.toAsset(resource), originalUrl: resource.secure_url } : null;
  }

  // copyFromUrl => RF-26.4 copia de servidor a servidor (Cloudinary descarga el original): respaldo y restauración
  public async copyFromUrl(url: string, publicId: string, type: MediaResourceType, tags: readonly string[]): Promise<string> {
    const result = await getCloudinary()
      .uploader.upload(url, { public_id: publicId, resource_type: type, overwrite: true, tags: [...tags] })
      .catch(() => {
        throw new MediaUploadFailedException();
      });
    return result.public_id;
  }

  // remove => borrado best-effort: un fallo del proveedor no debe bloquear la operación de negocio que lo pidió
  public async remove(publicId: string): Promise<void> {
    await getCloudinary()
      .uploader.destroy(publicId, { invalidate: true })
      .catch(() => undefined);
  }

  // removeMany => borrado en lote (una sola llamada a la Admin API); aquí sí se informa el fallo: es la acción pedida
  public async removeMany(publicIds: readonly string[]): Promise<void> {
    await getCloudinary()
      .api.delete_resources([...publicIds], { invalidate: true })
      .catch(() => {
        throw new MediaProviderException();
      });
  }

  private tagsFor(options: SaveOptions): string[] {
    return [...(options.tags ?? []), ...(options.watermark ? [WATERMARK_TAG] : [])];
  }

  // upload => sube un Buffer con las opciones dadas (punto único de subida para imagen y video: DRY)
  private async upload(buffer: Buffer, options: UploadApiOptions, type: MediaResourceType): Promise<MediaAsset> {
    const cloudinary = getCloudinary();
    // "new Promise((resolve, reject) => ...)" => adapta la API de callbacks "upload_stream" a async/await
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ ...options, resource_type: type }, (error, response) =>
        error || !response ? reject(error ?? new Error("Respuesta vacía")) : resolve(response)
      );
      stream.end(buffer); // Escribe el Buffer completo en el stream y lo cierra
    }).catch(() => {
      throw new MediaUploadFailedException();
    });
    return this.toAsset(result as unknown as CloudinaryResource);
  }

  // toAsset => convierte un recurso de Cloudinary en la entidad MediaAsset (un solo mapeo para todo el módulo: DRY).
  // RF-26.5 con la etiqueta "watermark" la URL de entrega lleva la marca (texto o logo) superpuesta abajo a la derecha
  private toAsset(resource: CloudinaryResource): MediaAsset {
    const raw = resource.context as { custom?: Record<string, string> } & Record<string, string> | undefined;
    const context = raw?.custom ?? raw ?? {};
    const type = (resource.resource_type === "video" ? "video" : "image") as MediaResourceType;
    const tags = resource.tags ?? [];
    const watermark = tags.includes(WATERMARK_TAG)
      ? [appConfig.WATERMARK_PUBLIC_ID
          ? { overlay: appConfig.WATERMARK_PUBLIC_ID.replace(/\//g, ":"), width: 0.2, flags: "relative", gravity: "south_east", opacity: 60, x: 16, y: 16 }
          : { overlay: { font_family: "Arial", font_size: 36, font_weight: "bold", text: appConfig.WATERMARK_TEXT }, color: "#ffffff", gravity: "south_east", opacity: 60, x: 16, y: 16 }]
      : [];
    const cloudinary = getCloudinary();
    return {
      url: cloudinary.url(resource.public_id, { secure: true, resource_type: type, fetch_format: "auto", quality: "auto", transformation: watermark }),
      publicId: resource.public_id,
      width: resource.width,
      height: resource.height,
      resourceType: type,
      tags: tags.filter((tag) => tag !== WATERMARK_TAG),
      watermark: watermark.length > 0,
      ...(context["alt"] ? { alt: context["alt"] } : {}),
      ...(context["title"] ? { title: context["title"] } : {}),
      ...(context["description"] ? { description: context["description"] } : {}),
      ...(resource.format ? { format: resource.format } : {}),
      ...(resource.bytes !== undefined ? { bytes: resource.bytes } : {}),
      ...(resource.created_at ? { createdAt: resource.created_at } : {}),
      ...(type === "video"
        ? { ...(resource.duration ? { duration: Math.round(resource.duration) } : {}), posterUrl: cloudinary.url(resource.public_id, { secure: true, resource_type: "video", format: "jpg", start_offset: "0" }) }
        : {}),
    };
  }
}

export const mediaRepository = new MediaRepository();
