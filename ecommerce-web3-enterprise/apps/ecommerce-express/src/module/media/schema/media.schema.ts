// media.schema.ts => validación (Zod) de las 5 operaciones de Media: subir, listar, actualizar, borrar uno y borrar en lote.
import { z } from "zod";
import { MEDIA_FOLDERS, MEDIA_ROOT } from "../model/media.model";

// PublicIdSchema => identificador de Cloudinary limitado al prefijo del proyecto (no se puede tocar otro asset de la cuenta).
// Una sola regla reutilizada por params, body y lote (DRY).
const PublicIdSchema = z.string().min(1).startsWith(`${MEDIA_ROOT}/`);

// Carpetas permitidas (derivadas del modelo: DRY): organiza los assets y evita escribir en rutas arbitrarias
// "tags" llega como texto separado por comas en multipart; "watermark" como "true"/"false" (RF-26.1 / 26.5)
const TagsText = z.string().max(400).optional().transform((value) => (value ? value.split(",") : []));
const Flag = z.enum(["true", "false"]).optional().transform((value) => value === "true");
export const UploadImageSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS).default("products"),
  tags: TagsText,
  watermark: Flag,
});
export const UploadVideoSchema = z.object({ folder: z.enum(MEDIA_FOLDERS).default("videos"), tags: TagsText });

// GET /media => listado paginado por cursor (Cloudinary no da total ni páginas numeradas, solo "next_cursor")
export const ListMediaQuerySchema = z.object({
  folder: z.enum(MEDIA_FOLDERS).optional(), // Sin carpeta => todos los assets del proyecto
  q: z.string().trim().max(80).optional(), // RF-26.1 búsqueda por nombre, etiqueta, alt o título
  tag: z.string().trim().max(40).optional(),
  type: z.enum(["image", "video"]).optional(),
  cursor: z.string().min(1).optional(), // "nextCursor" devuelto por la página anterior
  // "z.coerce.number()" => la query string llega como texto ("30") y se convierte a número
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ":id" => public_id codificado en la URL (encodeURIComponent): Cloudinary usa "/" dentro de sus IDs
export const MediaIdParamsSchema = z.object({ id: PublicIdSchema });

// PATCH /media/:id => metadatos (texto alternativo para accesibilidad) y/o archivo nuevo en el campo "file"
export const UpdateMediaSchema = z.object({
  alt: z.string().trim().min(1).max(150).optional(),
});
// MetaSchema => PATCH /media/:id/meta (RF-26.1 / 26.7): metadatos y etiquetas de imágenes o videos
export const MetaSchema = z.object({
  type: z.enum(["image", "video"]).default("image"),
  alt: z.string().trim().max(150).optional(),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  watermark: z.boolean().optional(),
});
export const UsageQuerySchema = z.object({ id: PublicIdSchema });
export const BackupIdParamsSchema = z.object({ backupId: z.string().regex(/^[a-f0-9]{24}$/i) });

// DELETE /media => borrado en lote (tope de 100: límite de la Admin API de Cloudinary por llamada)
export const DeleteManyMediaSchema = z.object({
  publicIds: z.array(PublicIdSchema).min(1).max(100),
});

// "z.infer" => tipos TypeScript derivados de los schemas: validación y tipado con una sola fuente de verdad
export type UploadImageInput = z.infer<typeof UploadImageSchema>;
export type UploadVideoInput = z.infer<typeof UploadVideoSchema>;
export type MetaInput = z.infer<typeof MetaSchema>;
export type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;
export type MediaIdParams = z.infer<typeof MediaIdParamsSchema>;
export type UpdateMediaInput = z.infer<typeof UpdateMediaSchema>;
export type DeleteManyMediaInput = z.infer<typeof DeleteManyMediaSchema>;
