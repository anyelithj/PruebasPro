// media.api.ts (Axios + TanStack Query) => Server State del Media Manager contra Express /api/v1/media (Cloudinary):
// biblioteca con búsqueda por texto, etiqueta, tipo y carpeta (RF-26.1) paginada por cursor (useInfiniteQuery: Cloudinary
// no da totales), subida multipart de imágenes con etiquetas y marca de agua (RF-26.3 / 26.5) y de videos (RF-26.7),
// metadatos, uso del archivo, respaldos y restauración (RF-26.4), reemplazo y borrado individual o en lote.
// Patrones: Repository/Gateway (único acceso HTTP de la feature) + Factory (useMediaMutation) + Observer (las
// mutaciones invalidan ["admin","media"] y la grilla se vuelve a dibujar sola). Paradigma asíncrono + funcional.
"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import type { MediaFolder, MediaKind } from "../lib/media.validator";

// MediaAsset => misma forma que MediaAsset de Express (media.model.ts)
export interface MediaAsset {
  url: string; // URL con f_auto/q_auto: Cloudinary entrega AVIF/WebP al navegador que lo soporte
  publicId: string;
  width: number;
  height: number;
  alt?: string;
  resourceType?: MediaKind;
  tags?: string[];
  watermark?: boolean; // RF-26.5
  title?: string;
  description?: string;
  format?: string;
  bytes?: number;
  createdAt?: string;
  duration?: number; // Videos: segundos
  posterUrl?: string; // Videos: fotograma de portada
}
interface MediaPage {
  items: MediaAsset[];
  nextCursor: string | null; // null => no hay más
}
// MediaFilters => RF-26.1 filtros de la biblioteca ("" = sin filtro)
export interface MediaFilters {
  folder: MediaFolder | "";
  q: string;
  tag: string;
  type: MediaKind | "";
}
export interface MediaUsage {
  type: string; // PRODUCT, BRAND, CATEGORY, CMS, SOCIAL_POST, UGC…
  id: string;
  label: string;
}
export interface MediaBackup {
  id: string;
  backupPublicId: string;
  version: number;
  bytes: number;
  createdAt: string;
}

const PAGE_SIZE = 30; // Lote moderado: menos imágenes en memoria y menos datos por petición
const KEY = ["admin", "media"] as const; // Prefijo común para invalidar todas las carpetas a la vez
const enc = encodeURIComponent; // publicId lleva "/" (carpetas): se codifica para viajar como un solo segmento

// useMediaToken => token del backend (las rutas de media exigen sesión y permiso de producto)
function useMediaToken() {
  const { accessToken } = useAuth();
  return accessToken;
}

// useMediaList => páginas por cursor con los filtros; "pageParam" es el cursor de la página anterior
export function useMediaList(filters: MediaFilters) {
  const token = useMediaToken();
  const query = { folder: filters.folder || undefined, q: filters.q || undefined, tag: filters.tag || undefined, type: filters.type || undefined };
  return useInfiniteQuery({
    queryKey: queryKeys.admin("media", query),
    queryFn: ({ pageParam }) => apiGet<MediaPage>("/media", { token, cache: "no-store", query: { ...query, cursor: pageParam, limit: PAGE_SIZE } }),
    initialPageParam: undefined as string | undefined, // "as" => tipo explícito del cursor inicial (sin cursor)
    getNextPageParam: (last) => last.nextCursor ?? undefined, // undefined => TanStack desactiva "hasNextPage"
    enabled: Boolean(token),
  });
}

// useMediaGet => Factory de lecturas secundarias (etiquetas, uso, respaldos): misma clave base => se invalidan juntas
function useMediaGet<T>(name: string, path: string | null, query: Record<string, string | undefined> = {}) {
  const token = useMediaToken();
  return useQuery({
    queryKey: queryKeys.admin("media", { name, path, ...query }),
    queryFn: () => apiGet<T>(path ?? "", { token, cache: "no-store", query }),
    enabled: Boolean(token && path),
  });
}

export const useMediaTags = (type: MediaKind) => useMediaGet<string[]>("tags", "/media/tags", { type }); // RF-26.1
export const useMediaUsage = (publicId: string) => useMediaGet<MediaUsage[]>("usage", "/media/usage", { id: publicId }); // RF-26.4
export const useMediaBackups = (publicId: string) => useMediaGet<MediaBackup[]>("backups", "/media/backup", { id: publicId });
export const useBackupStats = () => useMediaGet<{ files: number; bytes: number; lastBackupAt: string | null }>("backup-stats", "/media/backup/stats");

// useMediaMutation => Factory de mutaciones de media: todas invalidan la biblioteca al terminar (DRY)
function useMediaMutation<Input, Output>(request: (input: Input, token: string | undefined) => Promise<Output>) {
  const token = useMediaToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => request(input, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

// toForm => FormData con los archivos (campo "files" repetido) y los campos de texto (Axios fija el "boundary")
function toForm(files: File[], fields: Record<string, string>): FormData {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  return body;
}

// useUploadMedia => POST /media/upload (imágenes) y POST /media/video (videos, RF-26.7): un envío por tipo
export function useUploadMedia() {
  return useMediaMutation(async ({ files, folder, tags = [], watermark = false }: { files: File[]; folder: MediaFolder; tags?: string[]; watermark?: boolean }, token) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const videos = files.filter((file) => file.type.startsWith("video/"));
    const fields = { folder, ...(tags.length ? { tags: tags.join(",") } : {}) };
    // "Promise.all" => imágenes y videos suben en paralelo
    const [uploadedImages, uploadedVideos] = await Promise.all([
      images.length ? apiRequest<MediaAsset[]>("/media/upload", { method: "POST", body: toForm(images, { ...fields, watermark: String(watermark) }), token }).then((r) => r.data) : [],
      videos.length ? apiRequest<MediaAsset[]>("/media/video", { method: "POST", body: toForm(videos, { ...fields, folder: folder === "products" ? "videos" : folder }), token }).then((r) => r.data) : [],
    ]);
    return [...uploadedImages, ...uploadedVideos];
  });
}

// useUpdateMedia => PATCH /media/:id: texto alternativo y/o archivo de reemplazo (mismo publicId => URLs estables)
export function useUpdateMedia() {
  return useMediaMutation(async ({ publicId, alt, file }: { publicId: string; alt?: string; file?: File }, token) => {
    const body = new FormData();
    if (alt) body.append("alt", alt);
    if (file) body.append("file", file);
    return (await apiRequest<MediaAsset>(`/media/${enc(publicId)}`, { method: "PATCH", body, token })).data;
  });
}

// useUpdateMeta => PATCH /media/:id/meta (RF-26.1 / 26.5 / 26.7): alt, título, descripción, etiquetas y marca de agua
export function useUpdateMeta() {
  return useMediaMutation(async ({ publicId, ...meta }: { publicId: string; type: MediaKind; alt: string; title: string; description: string; tags: string[]; watermark: boolean }, token) =>
    (await apiRequest<MediaAsset>(`/media/${enc(publicId)}/meta`, { method: "PATCH", body: meta, token })).data
  );
}

// useRunBackup / useRestoreBackup => RF-26.4 respaldo incremental bajo demanda y restauración de una versión
export function useRunBackup() {
  return useMediaMutation(async (_: void, token) => (await apiRequest<{ copied: number; skipped: number }>("/media/backup", { method: "POST", token })).data);
}
export function useRestoreBackup() {
  return useMediaMutation(async (backupId: string, token) => (await apiRequest<{ restored: string }>(`/media/backup/${backupId}/restore`, { method: "POST", token })).data);
}

// useDeleteMedia => uno (DELETE /media/:id) o varios (DELETE /media con { publicIds }: una sola llamada a Cloudinary)
export function useDeleteMedia() {
  return useMediaMutation(async (publicIds: string[], token) => {
    if (publicIds.length === 1) await apiRequest<void>(`/media/${enc(publicIds[0] as string)}`, { method: "DELETE", token });
    else await apiRequest<void>("/media", { method: "DELETE", body: { publicIds }, token });
  });
}
