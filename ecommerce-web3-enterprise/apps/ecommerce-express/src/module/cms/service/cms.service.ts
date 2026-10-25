// cms.service.ts => casos de uso del CMS (Fase 8, consumido por Nuxt): CRUD de páginas, landings, lookbooks y eventos;
// captura de leads; configuración global de la tienda.
// Patrones: Strategy (validación de "data" por tipo: DATA_SCHEMAS), Cache-Aside (lecturas públicas 10 min en Redis,
// invalidadas al escribir), Repository (MongoDB) y Observer (lead.captured => analítica/marketing).
// Ahorro: las páginas públicas se sirven desde Redis y Nuxt las regenera por ISR => casi nunca se toca MongoDB.
import { cmsRepository, isDuplicate, type CmsRepository } from "../repository/cms.repository";
import { CONFIG_SCHEMAS, DATA_SCHEMAS, type ContentInput, type LeadInput, type ListContentQuery, type ListLeadsQuery, type UpdateContentInput } from "../schema/cms.schema";
import { CmsContentNotFoundException, CmsSlugTakenException, LeadAlreadyExistsException } from "../exception/cms.exception";
import type { CmsContentDto, CmsContentSummaryDto, CmsLeadDto, StoreConfigDto } from "../dto/cms.dto";
import type { ConfigSection, ContentKind } from "../model/cms.model";
import { cached, invalidatePattern } from "../../../shared/interceptor/cache.interceptor";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";
import { webhookDispatcher } from "../../webhook/handler/webhook.handler";
import { prisma } from "../../../config/database.config"; // RF-10.4 dependencias de una transportadora
import { ConflictException } from "../../../shared/filter/http-exception.filter";

const TTL_SECONDS = 10 * 60; // El contenido editorial cambia poco: 10 min de caché pública
// changed => invalida la caché del tipo y avisa por webhook "cms.updated" (Nuxt purga su ISR de esas rutas).
// "void" => sin esperar: la respuesta al editor no depende de las entregas (Observer asíncrono)
async function changed(kind: ContentKind, slug: string): Promise<void> {
  await invalidatePattern(`cms:${kind}:*`);
  void webhookDispatcher.dispatch("cms.updated", { kind, slug }).catch(() => undefined);
}

const key = (...parts: Array<string | number | boolean | undefined>) => `cms:${parts.map((part) => part ?? "").join(":")}`;

// parseData => valida el "data" del tipo concreto (Strategy). Si no cumple, Zod lanza y error.middleware responde 400
export function parseData(kind: ContentKind, data: unknown): Record<string, unknown> {
  return DATA_SCHEMAS[kind].parse(data ?? {}) as Record<string, unknown>;
}

// sanitizeHtml => defensa en profundidad para el HTML de GrapesJS que Nuxt dibuja con v-html: quita etiquetas
// ejecutables (script, iframe, object, embed, base, form...), atributos de evento (on*) y URLs javascript:/data:text.
// ponytail: limpieza por expresiones regulares; si se abre la edición a roles no confiables, usar un parser (DOMPurify).
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|base|form|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|base|form|meta|link)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action)\s*=\s*("|')\s*(javascript:|data:text)[^"']*\2/gi, '$1="#"');
}

// publicConfig => lo que la tienda puede ver sin sesión (sin direcciones de billetera ni reglas internas)
export function publicConfig(configs: StoreConfigDto[]): Record<string, unknown> {
  const bySection = Object.fromEntries(configs.map((config) => [config.section, config.value]));
  const payment = bySection["payment"] as
    | { stripe?: { enabled?: boolean; publishableKey?: string }; crypto?: { enabled?: boolean; networks?: Array<{ network: string }> }; cashOnDelivery?: boolean; bankTransfer?: { enabled?: boolean } }
    | undefined;
  return {
    // RF-08.3/08.9: medios activos y redes cripto disponibles (los datos de la cuenta y la billetera se entregan solo al pagar)
    payment: payment
      ? {
          stripe: { enabled: payment.stripe?.enabled ?? false, publishableKey: payment.stripe?.publishableKey ?? null },
          crypto: { enabled: payment.crypto?.enabled ?? false, networks: (payment.crypto?.networks ?? []).map((entry) => entry.network) },
          cashOnDelivery: payment.cashOnDelivery ?? false,
          bankTransfer: { enabled: payment.bankTransfer?.enabled ?? false },
        }
      : null,
    shipping: bySection["shipping"] ?? null,
    help: bySection["help"] ?? null, // RF-21.2 FAQ y datos de contacto (públicos)
    tax: bySection["tax"] ?? null,
    currency: bySection["currency"] ?? null,
    returns: bySection["returns"] ?? null, // RF-12.6 la tienda muestra la ventana de devolución
  };
}

export class CmsService {
  constructor(private readonly repository: CmsRepository = cmsRepository) {}

  // listContent => público: solo PUBLISHED (cacheado); staff: cualquier estado (sin caché: ve sus borradores al instante)
  public async listContent(kind: ContentKind, query: ListContentQuery, staff: boolean): Promise<{ items: CmsContentSummaryDto[]; meta: PaginationMeta }> {
    const { page: _page, limit: _limit, ...filters } = query;
    const page = toPageParams(query);
    const load = async () => {
      const { items, total } = await this.repository.findMany(kind, staff ? filters : { ...filters, status: "PUBLISHED" }, page);
      return { items, meta: buildPaginationMeta(page, total) };
    };
    return staff ? load() : cached(key(kind, "list", query.page, query.limit, query.locale, query.q, query.upcoming), TTL_SECONDS, load);
  }

  // getContentBySlug => el público no ve borradores (404: no se revela que existen)
  public async getContentBySlug(kind: ContentKind, slug: string, staff: boolean): Promise<CmsContentDto> {
    const content = staff ? await this.repository.findBySlug(kind, slug) : await cached(key(kind, "slug", slug), TTL_SECONDS, () => this.repository.findBySlug(kind, slug));
    if (!content || (!staff && content.status !== "PUBLISHED")) throw new CmsContentNotFoundException(kind, slug);
    return content;
  }

  public async createContent(kind: ContentKind, input: ContentInput, userId: string): Promise<CmsContentDto> {
    try {
      const created = await this.repository.create(kind, { ...input, body: { ...input.body, html: sanitizeHtml(input.body.html) }, data: parseData(kind, input.data) }, userId);
      await changed(kind, created.slug);
      return created;
    } catch (error) {
      if (isDuplicate(error)) throw new CmsSlugTakenException(input.slug);
      throw error;
    }
  }

  public async updateContent(kind: ContentKind, id: string, input: UpdateContentInput): Promise<CmsContentDto> {
    const current = await this.repository.findById(kind, id);
    if (!current) throw new CmsContentNotFoundException(kind, id);
    const changes = {
      ...input,
      ...(input.data === undefined ? {} : { data: parseData(kind, input.data) }),
      ...(input.body === undefined ? {} : { body: { ...input.body, html: sanitizeHtml(input.body.html) } }),
    };
    try {
      const updated = (await this.repository.update(kind, id, changes, current.status)) as CmsContentDto;
      await changed(kind, current.slug); // Listados y detalle del tipo (el slug anterior, si cambió)
      if (updated.slug !== current.slug) await changed(kind, updated.slug);
      return updated;
    } catch (error) {
      if (isDuplicate(error) && input.slug) throw new CmsSlugTakenException(input.slug);
      throw error;
    }
  }

  // deleteContentById => archiva (borrado lógico: el contenido y sus métricas SEO se conservan)
  public async deleteContentById(kind: ContentKind, id: string): Promise<void> {
    await this.updateContent(kind, id, { status: "ARCHIVED" });
  }

  // createLead => suscripción desde una landing publicada (Observer: se registra para analítica y marketing)
  public async createLead(slug: string, input: LeadInput): Promise<CmsLeadDto> {
    await this.getContentBySlug("landing", slug, false); // 404 si la landing no existe o no está publicada
    try {
      const lead = await this.repository.createLead(slug, input);
      logger.info("cms.lead.captured", { landing: slug }); // Sin el email en el log (dato personal)
      return lead;
    } catch (error) {
      if (isDuplicate(error)) throw new LeadAlreadyExistsException();
      throw error;
    }
  }

  public async listLeads(query: ListLeadsQuery): Promise<{ items: CmsLeadDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findLeads(query.landing, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // ---------- Configuración ----------
  public async getConfig(staff: boolean): Promise<StoreConfigDto[] | Record<string, unknown>> {
    const configs = await cached(key("config"), TTL_SECONDS, () => this.repository.findConfig());
    return staff ? configs : publicConfig(configs);
  }

  // updateConfig => valida la sección con su schema (Strategy) y reemplaza el documento completo
  public async updateConfig(section: ConfigSection, value: unknown, userId: string): Promise<StoreConfigDto> {
    const parsed = CONFIG_SCHEMAS[section].parse(value) as Record<string, unknown>;
    if (section === "shipping") await this.assertRemovableCarriers(parsed as { carriers: Array<{ code: string }> });
    const saved = await this.repository.saveConfig(section, parsed, userId);
    await invalidatePattern(key("config"));
    return saved;
  }

  // assertRemovableCarriers => RF-10.4 validar dependencias antes de ELIMINAR una transportadora: si tiene envíos en
  // curso o checkouts abiertos con su tarifa, se rechaza (desactivarla sí se permite: los envíos actuales siguen)
  private async assertRemovableCarriers(next: { carriers: Array<{ code: string }> }): Promise<void> {
    const current = (await this.repository.findConfig()).find((config) => config.section === "shipping")?.value as { carriers?: Array<{ code: string }> } | undefined;
    const kept = new Set(next.carriers.map((carrier) => carrier.code));
    for (const code of (current?.carriers ?? []).map((carrier) => carrier.code).filter((code) => !kept.has(code))) {
      const prefix = `${code}_`;
      const [shipments, checkouts] = await Promise.all([
        prisma.shipment.count({ where: { rateCode: { startsWith: prefix }, status: { in: ["PENDING", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } } }),
        prisma.checkoutSession.count({ where: { shippingRateCode: { startsWith: prefix }, status: { in: ["OPEN", "ADDRESS_SET", "PAYMENT_PENDING"] } } }),
      ]);
      if (shipments + checkouts > 0) throw new ConflictException(`La transportadora ${code} tiene ${shipments} envíos en curso y ${checkouts} compras abiertas: desactívala en lugar de eliminarla`, "CARRIER_IN_USE", { code, shipments, checkouts });
    }
  }
}

export const cmsService = new CmsService();
