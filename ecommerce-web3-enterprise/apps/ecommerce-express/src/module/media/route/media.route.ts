// media.route.ts => rutas de Media (montadas en /api/v1/media). Subir requiere estar autenticado;
// listar, actualizar y borrar son operaciones de catálogo (permiso sobre "product").
import { Router } from "express";
import { mediaController } from "../controller/media.controller";
import { imageUpload, videoUpload } from "../util/image.util";
import { DeleteManyMediaSchema, ListMediaQuerySchema, MediaIdParamsSchema, MetaSchema, UpdateMediaSchema, UploadImageSchema, UploadVideoSchema } from "../schema/media.schema";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";
import { validate } from "../../../shared/decorator/validate.decorator";

export const mediaRouter = Router();

// Cadena (Chain of Responsibility): auth -> RBAC -> Multer -> validación -> controller.
// Multer va ANTES de validate: en multipart el body ("folder", "alt") solo existe después de parsear el formulario.

// Cualquier usuario autenticado puede subir (avatar, evidencia de devolución, fotos de reseña)
mediaRouter.post("/upload", jwtAuthGuard, imageUpload.array("files", 10), validate({ body: UploadImageSchema }), mediaController.uploadImages);

// RF-26.7 videos: solo staff de catálogo/marketing (hasta 3 × 100 MB: no se abre a cualquier cuenta)
mediaRouter.post("/video", jwtAuthGuard, requirePermission("UPDATE", "product"), videoUpload.array("files", 3), validate({ body: UploadVideoSchema }), mediaController.uploadVideos);
// RF-26.1 etiquetas · RF-26.4 uso, respaldo y restauración (rutas fijas antes de "/:id")
mediaRouter.get("/tags", jwtAuthGuard, requirePermission("READ", "product"), mediaController.tags);
mediaRouter.get("/usage", jwtAuthGuard, requirePermission("READ", "product"), mediaController.usage);
mediaRouter.get("/backup", jwtAuthGuard, requirePermission("READ", "product"), mediaController.backups);
mediaRouter.get("/backup/stats", jwtAuthGuard, requirePermission("READ", "product"), mediaController.backupStats);
mediaRouter.post("/backup", jwtAuthGuard, requirePermission("UPDATE", "product"), mediaController.backup);
mediaRouter.post("/backup/:backupId/restore", jwtAuthGuard, requirePermission("UPDATE", "product"), mediaController.restore);
// Administrador de medios: listado paginado por cursor
mediaRouter.get("/", jwtAuthGuard, requirePermission("READ", "product"), validate({ query: ListMediaQuerySchema }), mediaController.listImages);

// "single('file')" => como máximo un archivo de reemplazo; sin archivo se actualizan solo los metadatos
mediaRouter.patch(
  "/:id",
  jwtAuthGuard,
  requirePermission("UPDATE", "product"),
  imageUpload.single("file"),
  validate({ params: MediaIdParamsSchema, body: UpdateMediaSchema }),
  mediaController.updateImage
);

// RF-26.1 / 26.5 / 26.7 metadatos y etiquetas (sin volver a subir el archivo)
mediaRouter.patch("/:id/meta", jwtAuthGuard, requirePermission("UPDATE", "product"), validate({ params: MediaIdParamsSchema, body: MetaSchema }), mediaController.updateMeta);
// Borrar assets es una operación de catálogo (uno por ID o en lote)
mediaRouter.delete("/:id", jwtAuthGuard, requirePermission("UPDATE", "product"), validate({ params: MediaIdParamsSchema }), mediaController.deleteImage);
mediaRouter.delete("/", jwtAuthGuard, requirePermission("UPDATE", "product"), validate({ body: DeleteManyMediaSchema }), mediaController.deleteImages);
