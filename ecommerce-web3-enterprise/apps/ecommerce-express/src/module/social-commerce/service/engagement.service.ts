// engagement.service.ts => RF-19.9 Live Shopping multiplataforma y RF-19.11 contenido generado por usuarios (UGC).
//  - Live: el staff programa la transmisión (YouTube/Facebook/Instagram/TikTok a la vez), la tienda la embebe con los
//    productos al lado y el anfitrión "fija" el producto que está mostrando (evento en tiempo real a los espectadores).
//  - UGC: clientes suben fotos/videos usando el producto o se importan las menciones de Instagram; nada se muestra sin
//    moderación (APPROVED). Da crédito al autor con el enlace original.
// Patrones: Facade + State (SCHEDULED -> LIVE -> ENDED; PENDING -> APPROVED | REJECTED) + Observer (socialEvents) +
// Idempotencia (externalId único al importar menciones). Paradigma: POO + asíncrono.
import axios from "axios";
import { appConfig } from "../../../config/app.config";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { productRepository } from "../../product/repository/product.repository";
import { LiveSessionModel, UgcModel, type LiveStatus, type UgcStatus } from "../model/channel.model";
import { socialEvents } from "./social.service";
import type { LiveInput, UgcImportInput, UgcInput, UpdateLiveInput } from "../schema/social.schema";

interface Viewer {
  id: string;
  roles: string[];
  firstName?: string;
}

// toLive => documento -> DTO plano con las tarjetas de producto (una consulta para todos los productos)
async function withProducts<T extends { productIds: string[] }>(rows: T[]) {
  const cards = new Map((await productRepository.findCardsByIds([...new Set(rows.flatMap((row) => row.productIds))])).map((card) => [card.id, card]));
  return rows.map((row) => ({ ...row, products: row.productIds.flatMap((id) => cards.get(id) ?? []) }));
}
const plainLive = (doc: Record<string, unknown> & { _id: unknown }) => {
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest } as { id: string; productIds: string[]; [key: string]: unknown };
};

// LIVE_TRANSITIONS => transiciones válidas (State): no se "revive" un live terminado
const LIVE_TRANSITIONS: Record<LiveStatus, LiveStatus[]> = { SCHEDULED: ["LIVE", "ENDED"], LIVE: ["ENDED"], ENDED: [] };

export class EngagementService {
  // ---------- RF-19.9 Live Shopping ----------
  public async lives(status?: LiveStatus) {
    const docs = await LiveSessionModel.find(status ? { status } : { status: { $in: ["SCHEDULED", "LIVE"] } }).sort({ status: 1, scheduledAt: 1 }).limit(50).lean();
    return withProducts(docs.map((doc) => plainLive(doc as never)));
  }

  public async live(id: string) {
    const doc = await LiveSessionModel.findById(id).lean();
    if (!doc) throw new NotFoundException("LiveSession", id);
    return (await withProducts([plainLive(doc as never)]))[0]!;
  }

  public async createLive(input: LiveInput, viewer: Viewer) {
    const doc = await LiveSessionModel.create({ ...input, hostId: viewer.id });
    return this.live(String(doc._id));
  }

  // updateLive => datos, productos, estado (con transición válida) o producto fijado (evento en vivo)
  public async updateLive(id: string, input: UpdateLiveInput, viewer: Viewer) {
    const current = await LiveSessionModel.findById(id).lean();
    if (!current) throw new NotFoundException("LiveSession", id);
    if (current.hostId !== viewer.id && !isAdmin(viewer)) throw new NotFoundException("LiveSession", id);
    const changes: Record<string, unknown> = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    if (input.status && input.status !== current.status) {
      if (!LIVE_TRANSITIONS[current.status as LiveStatus].includes(input.status)) throw new UnprocessableException(`No se puede pasar de ${current.status} a ${input.status}`, "INVALID_LIVE_TRANSITION");
      if (input.status === "LIVE") changes["startedAt"] = new Date();
      if (input.status === "ENDED") changes["endedAt"] = new Date();
    }
    if (input.pinnedProductId && !(input.productIds ?? current.productIds).includes(input.pinnedProductId)) throw new UnprocessableException("El producto fijado debe estar en la transmisión", "PIN_NOT_IN_LIVE");
    await LiveSessionModel.updateOne({ _id: id }, { $set: changes });
    const live = await this.live(id);
    socialEvents.emit("live.updated", { liveId: id, pinnedProductId: (live["pinnedProductId"] as string | null) ?? null, status: live["status"] as LiveStatus });
    return live;
  }

  public async deleteLive(id: string): Promise<void> {
    await LiveSessionModel.deleteOne({ _id: id });
  }

  // trackLiveClick => atribución: clic en un producto desde el live (métrica de conversión de la transmisión)
  public async trackLiveClick(id: string): Promise<void> {
    await LiveSessionModel.updateOne({ _id: id }, { $inc: { clicks: 1 } });
  }

  // ---------- RF-19.11 UGC ----------
  public async ugcForProduct(productId: string, limit = 24) {
    const rows = await UgcModel.find({ productId, status: "APPROVED" }).sort({ createdAt: -1 }).limit(limit).lean();
    return rows.map(({ _id, userId: _userId, ...row }) => ({ id: String(_id), ...row }));
  }

  public async ugcQueue(status: UgcStatus, page: number, limit: number) {
    const [rows, total] = await Promise.all([UgcModel.find({ status }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), UgcModel.countDocuments({ status })]);
    return { items: rows.map(({ _id, ...row }) => ({ id: String(_id), ...row })), total };
  }

  // submitUgc => el cliente comparte su foto/video con el producto (queda PENDIENTE de moderación)
  public async submitUgc(input: UgcInput, viewer: Viewer & { name: string }) {
    if (!(await productRepository.findCardsByIds([input.productId])).length) throw new NotFoundException("Product", input.productId);
    const doc = await UgcModel.create({ ...input, userId: viewer.id, author: viewer.name, source: "CUSTOMER", status: "PENDING" });
    return { id: String(doc._id), status: doc.status };
  }

  public async moderateUgc(id: string, status: UgcStatus): Promise<void> {
    const result = await UgcModel.updateOne({ _id: id }, { $set: { status } });
    if (result.matchedCount === 0) throw new NotFoundException("Ugc", id);
  }

  // importInstagramMentions => publicaciones donde etiquetaron a la cuenta (/{ig-user}/tags): entran como PENDIENTES
  // asociadas al producto indicado; el externalId único evita duplicados al repetir la importación
  public async importInstagramMentions(input: UgcImportInput): Promise<{ imported: number }> {
    if (!appConfig.META_ACCESS_TOKEN || !appConfig.INSTAGRAM_ACCOUNT_ID) throw new UnprocessableException("Instagram no está configurado", "INSTAGRAM_NOT_CONFIGURED");
    const { data } = await axios.get<{ data: Array<{ id: string; media_url?: string; media_type: string; caption?: string; permalink: string; username: string }> }>(
      `https://graph.facebook.com/${appConfig.META_GRAPH_VERSION}/${appConfig.INSTAGRAM_ACCOUNT_ID}/tags`,
      { params: { access_token: appConfig.META_ACCESS_TOKEN, fields: "id,media_url,media_type,caption,permalink,username", limit: 50 }, timeout: 15_000 }
    );
    const wanted = input.hashtag?.toLowerCase();
    const posts = data.data.filter((post) => post.media_url && (!wanted || post.caption?.toLowerCase().includes(`#${wanted}`)));
    const result = await UgcModel.bulkWrite(
      posts.map((post) => ({
        updateOne: {
          filter: { externalId: `ig:${post.id}` },
          update: { $setOnInsert: { productId: input.productId, author: `@${post.username}`, mediaUrl: post.media_url!, mediaType: post.media_type === "VIDEO" ? "VIDEO" : "IMAGE", caption: (post.caption ?? "").slice(0, 1000), source: "INSTAGRAM", externalId: `ig:${post.id}`, permalink: post.permalink, status: "PENDING", userId: null } },
          upsert: true,
        },
      }))
    );
    return { imported: result.upsertedCount };
  }
}

export const engagementService = new EngagementService();
