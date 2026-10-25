// media-ops.service.ts => RF-26.4 operación de la biblioteca de medios:
//  - usage: dónde se usa cada archivo (productos, marcas, categorías, colecciones, avatares, reseñas, pedidos, CMS,
//    publicaciones sociales y UGC) => evita borrar un archivo en uso y muestra su alcance
//  - backup: copia incremental de los originales a "ecommerce-web3-backup/<fecha>/..." (Cloudinary copia de servidor a
//    servidor: no pasa por la API) con bitácora en MongoDB; restore devuelve una versión respaldada a su public_id
// Patrones: Facade + Memento (cada respaldo es un estado restaurable) + Idempotencia (solo se respalda lo que cambió).
import { Schema, model } from "mongoose";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { getCloudinary } from "../../../config/cloudinary.config";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";
import { CmsContentModel } from "../../cms/model/cms.model";
import { SocialPostModel } from "../../social-commerce/model/social.model";
import { UgcModel } from "../../social-commerce/model/channel.model";
import { mediaRepository } from "../repository/media.repository";
import { MEDIA_ROOT, type MediaResourceType } from "../model/media.model";

export const BACKUP_ROOT = `${MEDIA_ROOT}-backup`;

// MediaBackup => una copia respaldada (public_id original, copia, versión de Cloudinary y fecha)
const backupSchema = new Schema(
  {
    publicId: { type: String, required: true },
    backupPublicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], default: "image" },
    version: { type: Number, required: true }, // Versión del original al respaldar (si cambia, se respalda de nuevo)
    bytes: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
backupSchema.index({ publicId: 1, createdAt: -1 });
export const MediaBackupModel = model("MediaBackup", backupSchema);

export interface MediaUsage {
  type: string;
  id: string;
  label: string;
}

export class MediaOpsService {
  // usage => referencias en PostgreSQL (una consulta UNION) y en MongoDB (búsqueda por expresión regular)
  public async usage(publicId: string): Promise<MediaUsage[]> {
    const like = `%${publicId}%`;
    const sql = await prisma.$queryRaw<MediaUsage[]>(Prisma.sql`
      SELECT 'PRODUCT' AS type, p.id, p.name AS label FROM product_images pi JOIN products p ON p.id = pi."productId" WHERE pi.url LIKE ${like}
      UNION ALL SELECT 'BRAND', id, name FROM brands WHERE "logoUrl" LIKE ${like}
      UNION ALL SELECT 'CATEGORY', id, name FROM categories WHERE "imageUrl" LIKE ${like}
      UNION ALL SELECT 'COLLECTION', id, name FROM collections WHERE "imageUrl" LIKE ${like}
      UNION ALL SELECT 'USER', id, "firstName" || ' ' || "lastName" FROM users WHERE "avatarUrl" LIKE ${like}
      UNION ALL SELECT 'REVIEW', id, title FROM reviews WHERE array_to_string("photoUrls", ' ') LIKE ${like}
      UNION ALL SELECT 'ORDER_ITEM', "orderId", "productName" FROM order_items WHERE "imageUrl" LIKE ${like}
      LIMIT 200`);
    const pattern = new RegExp(publicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // Escape: el id es texto literal
    const [social, ugc, cms] = await Promise.all([
      SocialPostModel.find({ mediaUrl: pattern }).select({ caption: 1 }).limit(50).lean().catch(() => []),
      UgcModel.find({ mediaUrl: pattern }).select({ author: 1 }).limit(50).lean().catch(() => []),
      // CMS: bloques con forma libre => se busca sobre el documento serializado (pocos cientos de páginas)
      CmsContentModel.find().select({ title: 1, slug: 1, blocks: 1, seo: 1, media: 1 }).limit(2000).lean().catch(() => []),
    ]);
    return [
      ...sql,
      ...social.map((post) => ({ type: "SOCIAL_POST", id: String(post._id), label: post.caption.slice(0, 60) })),
      ...ugc.map((item) => ({ type: "UGC", id: String(item._id), label: item.author })),
      ...cms.filter((doc) => JSON.stringify(doc).includes(publicId)).map((doc) => ({ type: "CMS", id: String(doc._id), label: String((doc as { title?: string }).title ?? "") })),
    ];
  }

  // backup => respaldo incremental: recorre los recursos del proyecto y copia solo los nuevos o modificados
  // (versión distinta a la última respaldada). Devuelve cuántos se copiaron
  public async backup(maxAssets = 500): Promise<{ copied: number; skipped: number }> {
    const day = new Date().toISOString().slice(0, 10);
    let copied = 0;
    let skipped = 0;
    for (const type of ["image", "video"] as MediaResourceType[]) {
      let cursor: string | undefined;
      do {
        const page = (await getCloudinary().api.resources({ type: "upload", resource_type: type, prefix: `${MEDIA_ROOT}/`, max_results: 100, next_cursor: cursor, tags: true })) as {
          resources: Array<{ public_id: string; version: number; secure_url: string; bytes: number; tags?: string[] }>;
          next_cursor?: string;
        };
        const last = new Map((await MediaBackupModel.aggregate<{ _id: string; version: number }>([{ $match: { publicId: { $in: page.resources.map((r) => r.public_id) } } }, { $group: { _id: "$publicId", version: { $max: "$version" } } }])).map((row) => [row._id, row.version]));
        for (const resource of page.resources) {
          if (copied >= maxAssets) return { copied, skipped };
          if (last.get(resource.public_id) === resource.version) {
            skipped += 1;
            continue;
          }
          try {
            const backupPublicId = await mediaRepository.copyFromUrl(resource.secure_url, `${BACKUP_ROOT}/${day}/${resource.public_id.slice(MEDIA_ROOT.length + 1)}`, type, resource.tags ?? []);
            await MediaBackupModel.create({ publicId: resource.public_id, backupPublicId, resourceType: type, version: resource.version, bytes: resource.bytes });
            copied += 1;
          } catch (error) {
            logger.warn("media_backup_failed", { publicId: resource.public_id, error: String(error) });
          }
        }
        cursor = page.next_cursor;
      } while (cursor);
    }
    return { copied, skipped };
  }

  public async backups(publicId: string) {
    return (await MediaBackupModel.find({ publicId }).sort({ createdAt: -1 }).limit(20).lean()).map(({ _id, ...row }) => ({ id: String(_id), ...row }));
  }

  // restore => devuelve el original al estado del respaldo elegido (mismo public_id: las URLs guardadas siguen válidas)
  public async restore(backupId: string) {
    const backup = await MediaBackupModel.findById(backupId).lean();
    if (!backup) throw new NotFoundException("MediaBackup", backupId);
    const copy = await mediaRepository.findById(backup.backupPublicId, backup.resourceType as MediaResourceType);
    if (!copy) throw new NotFoundException("MediaBackupCopy", backup.backupPublicId);
    await mediaRepository.copyFromUrl(copy.originalUrl, backup.publicId, backup.resourceType as MediaResourceType, copy.tags ?? []);
    return { restored: backup.publicId, from: backup.createdAt };
  }

  // stats => resumen del respaldo para el panel (archivos y espacio respaldados, último respaldo)
  public async stats() {
    const [row] = await MediaBackupModel.aggregate<{ files: number; bytes: number; last: Date }>([{ $group: { _id: null, files: { $sum: 1 }, bytes: { $sum: "$bytes" }, last: { $max: "$createdAt" } } }]);
    return { files: row?.files ?? 0, bytes: row?.bytes ?? 0, lastBackupAt: row?.last ?? null };
  }
}

export const mediaOpsService = new MediaOpsService();
