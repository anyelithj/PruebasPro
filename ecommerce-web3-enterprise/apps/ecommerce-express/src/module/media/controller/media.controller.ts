// media.controller.ts => capa HTTP del módulo Media. Sin lógica de negocio: delega en MediaService.
// Body, query y params ya llegan validados por el decorador "validate" de la ruta (DRY).
import type { Request, Response } from "express";
import { mediaService } from "../service/media.service";
import type { DeleteManyMediaInput, ListMediaQuery, MediaIdParams, MetaInput, UpdateMediaInput, UploadImageInput, UploadVideoInput } from "../schema/media.schema";
import { BackupIdParamsSchema, UsageQuerySchema } from "../schema/media.schema";
import { mediaOpsService } from "../service/media-ops.service"; // RF-26.4
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class MediaController {
  // uploadImages => POST /api/v1/media/upload (multipart: campo "files", hasta 10 imágenes)
  public readonly uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const { folder, tags, watermark } = req.body as UploadImageInput;
    // "req.files" lo llena Multer; "Array.isArray" => narrowing del tipo unión de Multer
    const files = Array.isArray(req.files) ? req.files : [];
    const uploaded = await mediaService.uploadImages(
      files.map((file) => file.buffer),
      folder,
      { tags, watermark }
    );
    sendSuccess(res, uploaded, HttpStatus.CREATED);
  });

  // uploadVideos => POST /api/v1/media/video (multipart: campo "files", hasta 3 videos de 100 MB) — RF-26.7
  public readonly uploadVideos = asyncHandler(async (req: Request, res: Response) => {
    const { folder, tags } = req.body as UploadVideoInput;
    const files = Array.isArray(req.files) ? req.files : [];
    sendSuccess(res, await mediaService.uploadVideos(files.map((file) => file.buffer), folder, tags), HttpStatus.CREATED);
  });

  // updateMeta => PATCH /api/v1/media/:id/meta (RF-26.1 / 26.5 / 26.7)
  public readonly updateMeta = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mediaService.updateMeta((req.params as MediaIdParams).id, req.body as MetaInput));
  });

  // tags => GET /api/v1/media/tags?type= (RF-26.1 filtro por etiqueta)
  public readonly tags = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mediaService.tags(req.query["type"] === "video" ? "video" : "image"));
  });

  // usage => GET /api/v1/media/usage?id= (RF-26.4 dónde se usa el archivo)
  public readonly usage = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mediaOpsService.usage(UsageQuerySchema.parse(req.query).id));
  });

  // backup / backups / restore / backupStats => RF-26.4 respaldo incremental y restauración
  public readonly backup = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await mediaOpsService.backup());
  });
  public readonly backups = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mediaOpsService.backups(UsageQuerySchema.parse(req.query).id));
  });
  public readonly restore = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mediaOpsService.restore(BackupIdParamsSchema.parse(req.params).backupId));
  });
  public readonly backupStats = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await mediaOpsService.stats());
  });

  // listImages => GET /api/v1/media?folder=&cursor=&limit=&q=&tag=&type=
  public readonly listImages = asyncHandler(async (req: Request, res: Response) => {
    // "as unknown as" => Express tipa req.query como ParsedQs; aquí ya contiene el resultado coercionado por Zod
    sendSuccess(res, await mediaService.listImages(req.query as unknown as ListMediaQuery));
  });

  // updateImage => PATCH /api/v1/media/:id (multipart opcional: campo "file" + "alt")
  public readonly updateImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as MediaIdParams;
    // "req.file" lo llena Multer con ".single('file')"; "?." => el archivo es opcional (solo metadatos)
    const updated = await mediaService.updateImage(id, req.file?.buffer, (req.body as UpdateMediaInput).alt);
    sendSuccess(res, updated);
  });

  // deleteImage => DELETE /api/v1/media/:id (":id" = public_id codificado con encodeURIComponent)
  public readonly deleteImage = asyncHandler(async (req: Request, res: Response) => {
    await mediaService.deleteImage((req.params as MediaIdParams).id);
    sendNoContent(res);
  });

  // deleteImages => DELETE /api/v1/media (body: { publicIds: [...] })
  public readonly deleteImages = asyncHandler(async (req: Request, res: Response) => {
    await mediaService.deleteImages((req.body as DeleteManyMediaInput).publicIds);
    sendNoContent(res);
  });
}

export const mediaController = new MediaController();
