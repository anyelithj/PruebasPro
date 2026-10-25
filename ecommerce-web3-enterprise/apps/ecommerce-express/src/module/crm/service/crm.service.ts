// crm.service.ts => CRM (sprint 7.2): clientes con LTV y segmento automático, scoring RFM, etiquetas, notas internas,
// ficha 360°, archivo y sincronización opcional con SuiteCRM 8 (open source, autohospedable: 0 USD).
// Patrones: Aggregate (estadísticas calculadas en la base), Strategy (segmentación y scoring como reglas puras),
// Adapter (SuiteCrmClient traduce el cliente a la API JSON:API v8 de SuiteCRM) y Observer (el alta sincroniza en
// segundo plano: la respuesta al panel no espera a SuiteCRM).
import { SEGMENT_PREFIX } from "../model/insight.model";
import { insightService } from "./insight.service";
import axios from "axios";
import { crmRepository, type CrmRepository, type ProfileView } from "../repository/crm.repository";
import { CustomerEmailTakenException, CustomerNotFoundException } from "../exception/crm.exception";
import type { AudienceMember, Customer360Dto, CustomerDto, CustomerStats, ScoringDto } from "../dto/crm.dto";
import type { CustomerInput, ListCustomersQuery, UpdateCustomerInput } from "../schema/crm.schema";
import type { Segment } from "../model/crm.model";
import { authRepository } from "../../auth/repository/auth.repository";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";

const DAY_MS = 24 * 60 * 60 * 1000;

// rfmScore => scoring automático 0..100 (Recencia 40 + Frecuencia 30 + Valor monetario 30). Función PURA.
// ponytail: umbrales fijos; un modelo de propensión (FastAPI customer_analytics) puede reemplazarlo sin tocar la API.
export function rfmScore(stats: Pick<CustomerStats, "orders" | "ltvCents" | "lastOrderAt">, now = Date.now()): number {
  const daysSince = stats.lastOrderAt ? (now - stats.lastOrderAt.getTime()) / DAY_MS : Infinity;
  const recency = daysSince <= 30 ? 40 : daysSince <= 90 ? 25 : daysSince <= 180 ? 10 : 0;
  const frequency = Math.min(30, stats.orders * 6); // 5 pedidos = puntaje completo
  const monetary = Math.min(30, Math.round((stats.ltvCents / 200_000_000) * 30)); // $2.000.000 COP = puntaje completo
  return recency + frequency + monetary;
}

// nextPurchase => fecha estimada de la próxima compra: intervalo medio entre pedidos (null con menos de 2 pedidos)
export function nextPurchase(stats: Pick<CustomerStats, "orders" | "firstOrderAt" | "lastOrderAt">): Date | null {
  if (stats.orders < 2 || !stats.firstOrderAt || !stats.lastOrderAt) return null;
  const interval = (stats.lastOrderAt.getTime() - stats.firstOrderAt.getTime()) / (stats.orders - 1);
  return new Date(stats.lastOrderAt.getTime() + interval);
}

// SuiteCrmClient => Adapter de SuiteCRM 8 (OAuth2 client_credentials + JSON:API). Token en memoria hasta vencer.
class SuiteCrmClient {
  private token: { value: string; expiresAt: number } | null = null;

  public get configured(): boolean {
    return Boolean(appConfig.SUITECRM_URL && appConfig.SUITECRM_CLIENT_ID && appConfig.SUITECRM_CLIENT_SECRET);
  }

  // upsertContact => crea (sin id) o actualiza (con id) el contacto; devuelve el ID de SuiteCRM
  public async upsertContact(contact: { id: string | null; firstName: string; lastName: string; email: string; phone: string | null }): Promise<string> {
    const attributes = { first_name: contact.firstName, last_name: contact.lastName, email1: contact.email, phone_mobile: contact.phone ?? "" };
    const { data } = await axios.request<{ data: { id: string } }>({
      method: contact.id ? "PATCH" : "POST",
      url: `${appConfig.SUITECRM_URL}/Api/V8/module`,
      data: { data: { type: "Contacts", ...(contact.id ? { id: contact.id } : {}), attributes } },
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/vnd.api+json" },
      timeout: 10_000,
    });
    return data.data.id;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      `${appConfig.SUITECRM_URL}/Api/access_token`,
      { grant_type: "client_credentials", client_id: appConfig.SUITECRM_CLIENT_ID, client_secret: appConfig.SUITECRM_CLIENT_SECRET },
      { timeout: 10_000 }
    );
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}

export class CrmService {
  constructor(
    private readonly repository: CrmRepository,
    private readonly suiteCrm = new SuiteCrmClient()
  ) {}

  // createCustomer => "registrar cliente con datos de contacto": cuenta CUSTOMER sin contraseña (podrá crearla con
  // "olvidé mi contraseña") + ficha comercial; reutiliza el alta de auth (DRY: rol, fidelidad y preferencias)
  public async createCustomer(input: CustomerInput, authorId: string): Promise<Customer360Dto> {
    if (await authRepository.findByEmail(input.email)) throw new CustomerEmailTakenException();
    const user = await authRepository.createUser({ email: input.email, passwordHash: null, firstName: input.firstName, lastName: input.lastName, phone: input.phone });
    await this.repository.upsertProfile(user.id, { tags: input.tags, ...(input.note ? { note: { text: input.note, authorId, at: new Date() } } : {}) });
    void this.syncSuiteCrm(user.id); // Segundo plano: el panel no espera a SuiteCRM
    return this.getCustomerById(user.id);
  }

  // listCustomers => "clientes con LTV y segmento calculado"
  public async listCustomers(query: ListCustomersQuery): Promise<{ items: CustomerDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const archived = await this.repository.archivedIds();
    let includeIds: string[] | undefined = query.archived ? archived : undefined;
    if (query.tag) {
      const tagged = await this.repository.taggedIds(query.tag);
      includeIds = includeIds ? includeIds.filter((id) => tagged.includes(id)) : tagged;
    }
    const { items, total } = await this.repository.findStats({ q: query.q, segment: query.segment, includeIds, excludeIds: query.archived ? undefined : archived }, page);
    const profiles = await this.repository.profiles(items.map((item) => item.id));
    return { items: items.map((stats) => this.toDto(stats, profiles.get(stats.id) ?? null)), meta: buildPaginationMeta(page, total) };
  }

  // getCustomerById => "ficha 360° del cliente por ID"
  public async getCustomerById(id: string): Promise<Customer360Dto> {
    const stats = await this.repository.findStatsById(id);
    if (!stats) throw new CustomerNotFoundException(id);
    const [profile, details] = await Promise.all([this.repository.profile(id), this.repository.details360(id)]);
    return {
      ...this.toDto(stats, profile),
      ...details,
      notes: [...(profile?.notes ?? [])].reverse(), // Más recientes primero
      avgOrderCents: stats.orders > 0 ? Math.round(stats.ltvCents / stats.orders) : 0,
      nextPurchaseAt: nextPurchase(stats),
      suiteCrmId: profile?.suiteCrmId ?? null,
    };
  }

  // updateCustomer => "actualizar datos, etiquetas y/o scoring — PATCH parcial"
  public async updateCustomer(id: string, input: UpdateCustomerInput, authorId: string): Promise<Customer360Dto> {
    if (!(await this.repository.findStatsById(id))) throw new CustomerNotFoundException(id);
    const contact = Object.fromEntries(Object.entries({ firstName: input.firstName, lastName: input.lastName, phone: input.phone }).filter(([, value]) => value !== undefined));
    if (Object.keys(contact).length > 0) {
      await this.repository.updateContact(id, contact);
      void this.syncSuiteCrm(id);
    }
    await this.repository.upsertProfile(id, {
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.score !== undefined ? { score: input.score } : {}),
      ...(input.note ? { note: { text: input.note, authorId, at: new Date() } } : {}),
    });
    return this.getCustomerById(id);
  }

  // deleteCustomerById => "archivar cliente del CRM" (la cuenta y sus pedidos no se tocan)
  public async deleteCustomerById(id: string): Promise<void> {
    if (!(await this.repository.findStatsById(id))) throw new CustomerNotFoundException(id);
    await this.repository.upsertProfile(id, { archivedAt: new Date() });
  }

  // audience => la usa Marketing: clientes del segmento con opt-in de marketing (sin archivados)
  // RF-22.2 "SEGMENT:<id>" => segmento personalizado por reglas (insight.service)
  public async audience(segment: Segment | "ALL" | `${typeof SEGMENT_PREFIX}${string}`): Promise<AudienceMember[]> {
    if (segment.startsWith(SEGMENT_PREFIX)) return insightService.audience(segment.slice(SEGMENT_PREFIX.length));
    return this.repository.findAudience(segment as Segment | "ALL", await this.repository.archivedIds());
  }

  // toDto => estadísticas + ficha comercial; el scoring manual tiene prioridad sobre el automático
  private toDto(stats: CustomerStats, profile: ProfileView | null): CustomerDto {
    const { firstOrderAt: _first, ...rest } = stats;
    const score: ScoringDto = profile?.score != null ? { value: profile.score, source: "MANUAL" } : { value: rfmScore(stats), source: "RFM" };
    return { ...rest, score, tags: profile?.tags ?? [], archived: Boolean(profile?.archivedAt) };
  }

  // syncSuiteCrm => integración opcional; un fallo se registra y NO afecta al CRM propio (degradación elegante)
  private async syncSuiteCrm(userId: string): Promise<void> {
    if (!this.suiteCrm.configured) return;
    try {
      const [stats, profile] = await Promise.all([this.repository.findStatsById(userId), this.repository.profile(userId)]);
      if (!stats) return;
      const suiteCrmId = await this.suiteCrm.upsertContact({ id: profile?.suiteCrmId ?? null, firstName: stats.firstName, lastName: stats.lastName, email: stats.email, phone: stats.phone });
      await this.repository.upsertProfile(userId, { suiteCrmId });
    } catch (error) {
      logger.warn("suitecrm_sync_failed", { userId, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const crmService = new CrmService(crmRepository);
