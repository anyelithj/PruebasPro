// social.service.ts => Social Commerce (sprint 6.1): publicaciones shoppable en el feed de la tienda y en
// Instagram / Facebook / TikTok, con programación, colaboración con influencers y analítica unificada.
// Patrones: Strategy + Adapter (un publicador por red, misma interfaz), Factory (registro de publicadores),
// State (DRAFT -> SCHEDULED -> PUBLISHING -> PUBLISHED | FAILED) y Observer (evento "social.published" que el
// gateway de Socket.io reenvía al feed en vivo).
import axios, { AxiosError } from "axios";
import { socialRepository, type SocialPostRow, type SocialPostWrite, type SocialRepository } from "../repository/social.repository";
import { EDITABLE_STATUSES, SocialCommentModel, SocialPostModel, type SocialPlatform, type SocialPostStatus } from "../model/social.model";
import type { IngestCommentsInput } from "../schema/social.schema";
import { signServiceToken } from "../../auth/util/token.util";
import { ServiceUnavailableException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

// SocialInsightsDto => RF-15.11 respuesta del motor (FastAPI /ml/sentiment/insights)
export interface SocialInsightsDto {
  summary: { total: number; counts: Record<string, number>; net_sentiment: number };
  negative_causes: Array<{ cause: string; label: string; count: number; share: number; examples: string[] }>;
  conclusion: string;
  items: Array<{ id: string; label: string; score: number; emotions: Record<string, number> }>;
}
import { InvalidTaggedProductsException, SocialPlatformUnavailableException, SocialPostNotEditableException, SocialPostNotFoundException } from "../exception/social.exception";
import type { SocialAnalyticDto, SocialPostDto } from "../dto/social.dto";
import type { ListSocialQuery, PublishInput, UpdatePublishInput } from "../schema/social.schema";
import { productRepository } from "../../product/repository/product.repository";
import { appConfig } from "../../../config/app.config";
import { TypedEventBus } from "../../../shared/util/event-bus.util";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";

interface Viewer {
  id: string;
  roles: string[];
}

// socialEvents => bus del módulo (Publish-Subscribe): el gateway en tiempo real se suscribe sin que este service
// conozca Socket.io (bajo acoplamiento, DIP)
export const socialEvents = new TypedEventBus<{
  "social.published": { postId: string };
  "live.updated": { liveId: string; pinnedProductId: string | null; status: "SCHEDULED" | "LIVE" | "ENDED" }; // RF-19.9
}>("social");

// SocialPublisher => puerto de publicación (Adapter de cada API externa a una sola interfaz)
interface SocialPublisher {
  readonly configured: boolean; // Sin credenciales la red no se ofrece (503)
  publish(post: SocialPostRow): Promise<string>; // Devuelve el ID de la publicación en la red
}

const HTTP_TIMEOUT_MS = 15_000; // Las redes descargan la imagen: margen razonable sin dejar sockets colgados
const graphUrl = (path: string) => `https://graph.facebook.com/${appConfig.META_GRAPH_VERSION}/${path}`;

// Instagram Graph API: 1) crea el contenedor de medios 2) lo publica (flujo oficial de dos pasos)
class InstagramPublisher implements SocialPublisher {
  public get configured(): boolean {
    return Boolean(appConfig.META_ACCESS_TOKEN && appConfig.INSTAGRAM_ACCOUNT_ID);
  }

  public async publish(post: SocialPostRow): Promise<string> {
    const account = appConfig.INSTAGRAM_ACCOUNT_ID ?? "";
    const auth = { access_token: appConfig.META_ACCESS_TOKEN };
    // RF-19.8 Story: mismo flujo de dos pasos con media_type=STORIES (la Story no lleva texto: va en la imagen)
    const media = post.format === "STORY" ? { image_url: post.mediaUrl, media_type: "STORIES" } : { image_url: post.mediaUrl, caption: post.caption };
    const { data: container } = await axios.post<{ id: string }>(graphUrl(`${account}/media`), null, {
      params: { ...auth, ...media },
      timeout: HTTP_TIMEOUT_MS,
    });
    const { data } = await axios.post<{ id: string }>(graphUrl(`${account}/media_publish`), null, { params: { ...auth, creation_id: container.id }, timeout: HTTP_TIMEOUT_MS });
    return data.id;
  }
}

// Facebook Page: una foto con texto en el muro de la página
class FacebookPublisher implements SocialPublisher {
  public get configured(): boolean {
    return Boolean(appConfig.META_ACCESS_TOKEN && appConfig.FACEBOOK_PAGE_ID);
  }

  public async publish(post: SocialPostRow): Promise<string> {
    if (post.format === "STORY") {
      // RF-19.8 Story de página: 1) foto NO publicada 2) photo_stories con ese photo_id
      const page = appConfig.FACEBOOK_PAGE_ID ?? "";
      const { data: photo } = await axios.post<{ id: string }>(graphUrl(`${page}/photos`), null, { params: { access_token: appConfig.META_ACCESS_TOKEN, url: post.mediaUrl, published: false }, timeout: HTTP_TIMEOUT_MS });
      const { data: story } = await axios.post<{ post_id?: string; id?: string }>(graphUrl(`${page}/photo_stories`), null, { params: { access_token: appConfig.META_ACCESS_TOKEN, photo_id: photo.id }, timeout: HTTP_TIMEOUT_MS });
      return story.post_id ?? story.id ?? photo.id;
    }
    const { data } = await axios.post<{ id: string; post_id?: string }>(graphUrl(`${appConfig.FACEBOOK_PAGE_ID ?? ""}/photos`), null, {
      params: { access_token: appConfig.META_ACCESS_TOKEN, url: post.mediaUrl, caption: post.caption },
      timeout: HTTP_TIMEOUT_MS,
    });
    return data.post_id ?? data.id;
  }
}

// TikTok Content Posting API: publicación de foto desde URL (modo PHOTO + PULL_FROM_URL)
class TikTokPublisher implements SocialPublisher {
  public get configured(): boolean {
    return Boolean(appConfig.TIKTOK_ACCESS_TOKEN);
  }

  public async publish(post: SocialPostRow): Promise<string> {
    const { data } = await axios.post<{ data: { publish_id: string } }>(
      "https://open.tiktokapis.com/v2/post/publish/content/init/",
      {
        post_info: { title: post.caption.slice(0, 90), description: post.caption },
        source_info: { source: "PULL_FROM_URL", photo_images: [post.mediaUrl], photo_cover_index: 0 },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      },
      { headers: { Authorization: `Bearer ${appConfig.TIKTOK_ACCESS_TOKEN}` }, timeout: HTTP_TIMEOUT_MS }
    );
    return data.data.publish_id;
  }
}

// errorText => mensaje útil de la API externa SIN exponer el token (no se registra la URL con access_token)
function errorText(platform: SocialPlatform, error: unknown): string {
  const apiMessage = error instanceof AxiosError ? (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message : undefined;
  return `${platform}: ${apiMessage ?? (error instanceof Error ? error.message : "error desconocido")}`;
}

// nextStatus => transición pedida en un PATCH (State): borrador, programada, publicar ahora o sin cambio
function nextStatus(draft: boolean | undefined, scheduledAt: Date | undefined, current: SocialPostStatus): SocialPostStatus {
  if (draft) return "DRAFT";
  if (scheduledAt) return "SCHEDULED";
  return draft === false ? "PUBLISHING" : current;
}

export class SocialService {
  // Factory/registro de estrategias: agregar Pinterest = una clase nueva + una entrada (OCP)
  private readonly publishers: Record<SocialPlatform, SocialPublisher> = {
    INSTAGRAM: new InstagramPublisher(),
    FACEBOOK: new FacebookPublisher(),
    TIKTOK: new TikTokPublisher(),
  };

  constructor(private readonly repository: SocialRepository) {}

  // createSocialPost => "publicar en IG/TikTok/FB mediante service unificado"
  public async createSocialPost(input: PublishInput, viewer: Viewer): Promise<SocialPostDto> {
    this.assertPlatforms(input.platforms);
    // RF-19.8 la API de TikTok no publica Stories: solo Instagram y Facebook
    if (input.format === "STORY" && input.platforms.includes("TIKTOK")) throw new UnprocessableException("TikTok no admite Stories por API", "STORY_PLATFORM_UNSUPPORTED");
    await this.assertProducts(input.productIds, viewer);
    const { draft, influencer, ...fields } = input;
    const status: SocialPostStatus = draft ? "DRAFT" : input.scheduledAt ? "SCHEDULED" : "PUBLISHING";
    const row = await this.repository.create({ ...fields, influencer: influencer ? { ...influencer, avatarUrl: influencer.avatarUrl ?? null } : null, authorId: viewer.id, status });
    return this.toDto(status === "PUBLISHING" ? await this.publishNow(row) : row);
  }

  // updateSocialPost => "editar publicación programada — PATCH parcial" (y publicar un borrador con draft:false)
  public async updateSocialPost(id: string, input: UpdatePublishInput, viewer: Viewer): Promise<SocialPostDto> {
    const row = await this.ownedPost(id, viewer);
    if (!EDITABLE_STATUSES.includes(row.status)) throw new SocialPostNotEditableException(row.status);
    if (input.platforms) this.assertPlatforms(input.platforms);
    if (input.productIds) await this.assertProducts(input.productIds, viewer);

    const { draft, influencer, ...fields } = input;
    // Transición de estado explícita (State): borrador, programada o publicar ahora; si no se pide, se conserva
    const status = nextStatus(draft, input.scheduledAt, row.status);
    // Solo los campos enviados (Zod deja "undefined" en los ausentes): "$set" parcial
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as SocialPostWrite;
    if (influencer) changes.influencer = { ...influencer, avatarUrl: influencer.avatarUrl ?? null };
    const updated = await this.repository.update(id, { ...changes, status, error: null });
    if (!updated) throw new SocialPostNotFoundException(id);
    return this.toDto(status === "PUBLISHING" ? await this.publishNow(updated) : updated);
  }

  // deleteSocialPostById => "eliminar publicación de red social" del feed de la tienda.
  // ponytail: las publicaciones ya enviadas a las redes se conservan allí (Instagram no permite borrar por API);
  // borrado remoto en Facebook con DELETE /{post-id} si se requiere.
  public async deleteSocialPostById(id: string, viewer: Viewer): Promise<void> {
    await this.ownedPost(id, viewer);
    await this.repository.delete(id);
  }

  // listSocialProducts => "catálogo shoppable multi-canal": feed público de publicaciones con sus productos
  public async listSocialProducts(query: ListSocialQuery): Promise<{ items: SocialPostDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findPublished({ influencer: query.influencer, productId: query.productId }, page);
    return { items: await this.toDtos(items), meta: buildPaginationMeta(page, total) };
  }

  // getSocialProduct => detalle de una publicación (pública si está PUBLISHED; si no, solo autor o admin)
  public async getSocialProduct(id: string, viewer?: Viewer): Promise<SocialPostDto> {
    const row = await this.repository.findById(id);
    const visible = row && (row.status === "PUBLISHED" || (viewer && (row.authorId === viewer.id || isAdmin(viewer))));
    if (!row || !visible) throw new SocialPostNotFoundException(id);
    return this.toDto(row);
  }

  // listSocialAnalytics => "métricas unificadas multi-plataforma" (el vendedor ve solo las suyas)
  public async listSocialAnalytics(viewer: Viewer): Promise<SocialAnalyticDto[]> {
    return this.repository.analytics(isAdmin(viewer) ? undefined : viewer.id);
  }

  // publishDueScheduled => job de 1 minuto (bootstrap): publica las programadas vencidas, de a una (atómico)
  public async publishDueScheduled(batch = 10): Promise<number> {
    let published = 0;
    for (let index = 0; index < batch; index += 1) {
      const row = await this.repository.claimDueScheduled(new Date());
      if (!row) break; // No quedan pendientes: el job termina enseguida (casi sin costo cuando no hay nada)
      await this.publishNow(row);
      published += 1;
    }
    return published;
  }

  // publishNow => envía a cada red en paralelo; "allSettled" => una red caída no impide publicar en las demás
  private async publishNow(row: SocialPostRow): Promise<SocialPostRow> {
    const results = await Promise.allSettled(row.platforms.map((platform) => this.publishers[platform].publish(row)));
    const externalIds: Record<string, string> = {};
    const errors: string[] = [];
    results.forEach((result, index) => {
      const platform = row.platforms[index] as SocialPlatform;
      if (result.status === "fulfilled") externalIds[platform] = result.value;
      else errors.push(errorText(platform, result.reason));
    });
    // Sin redes (solo feed de la tienda) o con al menos una red exitosa => PUBLISHED
    const ok = row.platforms.length === 0 || Object.keys(externalIds).length > 0;
    if (errors.length > 0) logger.warn("social_publish_errors", { postId: row.id, errors });
    const updated = await this.repository.update(row.id, {
      status: ok ? "PUBLISHED" : "FAILED",
      publishedAt: ok ? new Date() : null,
      externalIds,
      error: errors.length > 0 ? errors.join(" | ").slice(0, 500) : null,
    });
    if (ok) socialEvents.emit("social.published", { postId: row.id }); // El feed en vivo avisa a los visitantes
    return updated ?? row;
  }

  // ownedPost => la publicación existe y el usuario es su autor o admin (si no: 404, no se revela)
  private async ownedPost(id: string, viewer: Viewer): Promise<SocialPostRow> {
    const row = await this.repository.findById(id);
    if (!row || (row.authorId !== viewer.id && !isAdmin(viewer))) throw new SocialPostNotFoundException(id);
    return row;
  }

  private assertPlatforms(platforms: SocialPlatform[]): void {
    const missing = platforms.find((platform) => !this.publishers[platform].configured);
    if (missing) throw new SocialPlatformUnavailableException(missing);
  }

  // assertProducts => productos activos; un VENDOR solo etiqueta los suyos (el admin, cualquiera)
  private async assertProducts(ids: string[], viewer: Viewer): Promise<void> {
    const found = await this.repository.ownedActiveProducts(ids, isAdmin(viewer) ? undefined : viewer.id);
    const invalid = ids.filter((id) => !found.has(id));
    if (invalid.length > 0) throw new InvalidTaggedProductsException(invalid);
  }

  private async toDto(row: SocialPostRow): Promise<SocialPostDto> {
    return (await this.toDtos([row]))[0] as SocialPostDto;
  }

  // toDtos => tarjetas de TODOS los productos de la página en una sola consulta (sin N+1).
  // Se omiten authorId y externalIds (datos internos que el feed público no necesita).
  private async toDtos(rows: SocialPostRow[]): Promise<SocialPostDto[]> {
    const cards = new Map((await productRepository.findCardsByIds([...new Set(rows.flatMap((row) => row.productIds))])).map((card) => [card.id, card]));
    return rows.map(({ authorId: _authorId, externalIds: _externalIds, productIds, ...row }) => ({ ...row, products: productIds.flatMap((id) => cards.get(id) ?? []) }));
  }
}

// ---------- RF-15.11 sentimiento en redes sociales ----------

// ingestComments => guarda comentarios (upsert por externalId: el webhook puede reenviar el mismo comentario)
export async function ingestComments(input: IngestCommentsInput): Promise<{ stored: number }> {
  const result = await SocialCommentModel.bulkWrite(
    // "postId ?? null" => el esquema guarda null (exactOptionalPropertyTypes no admite undefined)
    input.comments.map((comment) => ({ updateOne: { filter: { externalId: comment.externalId }, update: { $setOnInsert: { ...comment, postId: comment.postId ?? null } }, upsert: true } }))
  );
  return { stored: result.upsertedCount };
}

// socialSentiment => comentarios + textos de las publicaciones del período -> motor de FastAPI: polaridad, emociones,
// causas del sentimiento negativo (con ejemplos) y una conclusión para el equipo
export async function socialSentiment(days: number): Promise<SocialInsightsDto> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [comments, posts] = await Promise.all([
    SocialCommentModel.find({ publishedAt: { $gte: since } }).sort({ publishedAt: -1 }).limit(400).lean(),
    SocialPostModel.find({ status: "PUBLISHED", publishedAt: { $gte: since } }).select({ caption: 1 }).limit(100).lean(),
  ]);
  const texts = [...comments.map((comment) => ({ id: `comment:${String(comment._id)}`, text: comment.text })), ...posts.map((post) => ({ id: `post:${String(post._id)}`, text: post.caption.slice(0, 1000) }))];
  if (texts.length === 0) return { summary: { total: 0, counts: {}, net_sentiment: 0 }, negative_causes: [], conclusion: "Aún no hay comentarios en el período.", items: [] };
  try {
    const { data } = await axios.post<{ data: SocialInsightsDto }>(`${appConfig.FASTAPI_URL}/api/v1/ml/sentiment/insights`, { texts }, { timeout: 15_000, headers: { Authorization: `Bearer ${signServiceToken()}` } });
    return data.data;
  } catch {
    throw new ServiceUnavailableException("El motor de análisis de sentimiento no está disponible");
  }
}

export const socialService = new SocialService(socialRepository);
