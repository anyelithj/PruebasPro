// media.dto.ts => contratos de salida del módulo Media (lo que recibe el frontend).
import type { MediaAsset } from "../model/media.model";
import type { ImageInspection } from "../util/vision.util";

// UploadedImageDto => el asset + (solo fotos de producto) el reporte de calidad RF-06.6 para avisar al administrador
// ("&" => tipo intersección: extiende la entidad sin modificarla)
export type UploadedImageDto = MediaAsset & { quality?: ImageInspection["quality"] | undefined };

// Página del listado: "nextCursor" null => no hay más resultados (paginación por cursor de Cloudinary)
export interface MediaPageDto {
  readonly items: MediaAsset[];
  readonly nextCursor: string | null;
}
