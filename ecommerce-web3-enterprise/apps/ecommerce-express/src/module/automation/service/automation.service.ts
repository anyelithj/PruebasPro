// automation.service.ts => Automatización con n8n (sprint 6.1): registro de flujos, disparo por eventos de dominio,
// ejecución manual con reintentos y bitácora con métricas de salud.
// Patrones: Adapter (N8nClient traduce a la API REST de n8n), Command (cada ejecución es un comando con reintentos),
// Observer (suscripción al bus de comercio), State (RUNNING -> SUCCESS | FAILED) y Mediator (Express orquesta;
// n8n hace el trabajo: emails, WhatsApp, CRM, etc. sin código en la tienda).
import axios, { AxiosError } from "axios";
import { automationRepository, EMPTY_METRICS, type AutomationRepository, type WorkflowRow, type WorkflowWrite } from "../repository/automation.repository";
import { COMMERCE_AUTOMATION_EVENTS, type AutomationEvent, type TriggerType } from "../model/automation.model";
import { findTemplate, WORKFLOW_TEMPLATES } from "../model/automation.templates"; // RF-20.2 plantillas
import { inventoryEvents } from "../../inventory/event/inventory.event";
import { notificationService } from "../../notification/service/notification.service";
import { whatsappProvider } from "../../notification/provider/whatsapp.provider";
import { marketingService } from "../../marketing/service/marketing.service";
import { prisma } from "../../../config/database.config";
import { Roles } from "../../../shared/constants/roles.constants";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { N8nApiException, N8nUnavailableException, WorkflowInactiveException, WorkflowNotFoundException } from "../exception/automation.exception";
import type { AutomationHealthDto, ExecutionStatusDto, WorkflowDetailDto, WorkflowDto, WorkflowVersionDto } from "../dto/automation.dto";
import type { UpdateWorkflowInput, WorkflowInput } from "../schema/automation.schema";
import { commerceEvents } from "../../order/event/order.event";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";

const MAX_ATTEMPTS = 3; // Reintentos con backoff exponencial: 0,5 s -> 1 s
const BASE_BACKOFF_MS = 500;
const WEBHOOK_TIMEOUT_MS = 10_000;

// sleep => pausa no bloqueante (Promise + setTimeout) entre reintentos
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// N8nClient => Adapter de la API pública de n8n (header X-N8N-API-KEY) y de sus webhooks
class N8nClient {
  public get configured(): boolean {
    return Boolean(appConfig.N8N_API_URL && appConfig.N8N_API_KEY);
  }

  // createWorkflow => POST /workflows con nodos y conexiones del editor de n8n; devuelve el ID creado
  public async createWorkflow(name: string, definition: NonNullable<WorkflowInput["definition"]>): Promise<string> {
    const { data } = await this.api<{ id: string }>("post", "/workflows", { name, ...definition });
    return data.id;
  }

  public async setActive(id: string, active: boolean): Promise<void> {
    await this.api("post", `/workflows/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`);
  }

  public async deleteWorkflow(id: string): Promise<void> {
    await this.api("delete", `/workflows/${encodeURIComponent(id)}`);
  }

  // callWebhook => dispara el nodo Webhook del flujo. La URL se arma SIEMPRE sobre N8N_WEBHOOK_URL (anti-SSRF)
  public async callWebhook(path: string, body: unknown): Promise<number> {
    const response = await axios.post(`${appConfig.N8N_WEBHOOK_URL.replace(/\/$/, "")}/${path}`, body, { timeout: WEBHOOK_TIMEOUT_MS });
    return response.status;
  }

  private async api<T = unknown>(method: "post" | "delete", path: string, body?: unknown): Promise<{ data: T }> {
    if (!this.configured) throw new N8nUnavailableException();
    try {
      return await axios.request<T>({ method, url: `${appConfig.N8N_API_URL}${path}`, data: body, headers: { "X-N8N-API-KEY": appConfig.N8N_API_KEY }, timeout: WEBHOOK_TIMEOUT_MS });
    } catch (error) {
      const detail = error instanceof AxiosError ? `${error.response?.status ?? "sin respuesta"} ${JSON.stringify(error.response?.data ?? error.message).slice(0, 200)}` : String(error);
      throw new N8nApiException(detail);
    }
  }
}

// retryable => 5xx, 429 o error de red se reintentan; un 4xx es un error de configuración (reintentar no sirve)
function retryable(error: unknown): boolean {
  if (!(error instanceof AxiosError) || !error.response) return true;
  return error.response.status >= 500 || error.response.status === 429;
}

// describe => mensaje corto del error para la bitácora (sin volcar objetos enormes en MongoDB)
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 500);

export class AutomationService {
  constructor(
    private readonly repository: AutomationRepository,
    public readonly n8n = new N8nClient()
  ) {}

  // createWorkflow => "crear workflow n8n con triggers — definition"
  public async createWorkflow(input: WorkflowInput, userId: string): Promise<WorkflowDto> {
    const { definition, ...fields } = input;
    let n8nWorkflowId: string | null = null;
    if (definition) {
      n8nWorkflowId = await this.n8n.createWorkflow(input.name, definition);
      if (input.active) await this.n8n.setActive(n8nWorkflowId, true);
    }
    const row = await this.repository.create({ ...fields, description: fields.description ?? null, event: fields.event ?? null, n8nWorkflowId, createdBy: userId });
    return { ...row, metrics: EMPTY_METRICS };
  }

  // listWorkflows => "listar workflows con estado y métricas"
  public async listWorkflows(query: PaginationQuery): Promise<{ items: WorkflowDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(page);
    const metrics = await this.repository.metrics(items.map((item) => item.id));
    return { items: items.map((item) => ({ ...item, metrics: metrics.get(item.id) ?? EMPTY_METRICS })), meta: buildPaginationMeta(page, total) };
  }

  // getWorkflowById => "estado y logs de ejecución por ID"
  public async getWorkflowById(id: string): Promise<WorkflowDetailDto> {
    const row = await this.find(id);
    const [metrics, runs] = await Promise.all([this.repository.metrics([id]), this.repository.recentRuns(id)]);
    return { ...row, metrics: metrics.get(id) ?? EMPTY_METRICS, runs };
  }

  // updateWorkflow => "modificar configuración del workflow — PATCH parcial" (sincroniza activo/inactivo con n8n)
  public async updateWorkflow(id: string, input: UpdateWorkflowInput, changedBy = "system"): Promise<WorkflowDto> {
    const current = await this.find(id);
    await this.repository.snapshot(current, changedBy); // RF-20.7 versión anterior al historial
    if (input.active !== undefined && input.active !== current.active && current.n8nWorkflowId) await this.n8n.setActive(current.n8nWorkflowId, input.active);
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as WorkflowWrite;
    const updated = await this.repository.update(id, changes);
    if (!updated) throw new WorkflowNotFoundException(id);
    const metrics = await this.repository.metrics([id]);
    return { ...updated, metrics: metrics.get(id) ?? EMPTY_METRICS };
  }

  // deleteWorkflowById => "eliminar workflow y sus ejecuciones" (también en n8n si se creó desde aquí)
  public async deleteWorkflowById(id: string): Promise<void> {
    const row = await this.find(id);
    if (row.n8nWorkflowId && this.n8n.configured) await this.n8n.deleteWorkflow(row.n8nWorkflowId);
    await this.repository.delete(id);
  }

  // createWorkflowRun => "ejecutar workflow específico por ID": responde 202 con la ejecución en curso;
  // el resultado se consulta en GET /:id (el cliente no espera los reintentos)
  public async createWorkflowRun(id: string, payload: Record<string, unknown>): Promise<ExecutionStatusDto> {
    const row = await this.find(id);
    if (!row.active) throw new WorkflowInactiveException();
    return this.startRun(row, "MANUAL", { workflow: row.name, payload });
  }

  // registerSubscribers => Observer: cada evento de dominio dispara los flujos activos suscritos a él (bootstrap)
  public registerSubscribers(): void {
    for (const event of COMMERCE_AUTOMATION_EVENTS) commerceEvents.on(event, (data) => this.trigger(event, data));
    // RF-20.2 inventario: stock bajo y ajustes (actualización de inventario en canales, reabastecimiento)
    inventoryEvents.on("inventory.low", (data) => this.trigger("inventory.low", data));
    inventoryEvents.on("inventory.adjusted", (data) => this.trigger("inventory.adjusted", data));
  }

  // trigger => dispara los flujos activos de un evento (lo usan también otros módulos: "customer.inactive")
  public async trigger(event: AutomationEvent, data: unknown): Promise<void> {
    const workflows = await this.repository.findActiveByEvent(event);
    await Promise.all(workflows.map((workflow) => this.startRun(workflow, "EVENT", { event, data, occurredAt: new Date().toISOString() })));
  }

  // ---------- RF-20.2 plantillas ----------
  public templates() {
    return WORKFLOW_TEMPLATES.map(({ definition, ...template }) => ({ ...template, nodes: definition.nodes.length }));
  }

  public template(key: string) {
    const template = findTemplate(key);
    if (!template) throw new NotFoundException("WorkflowTemplate", key);
    return template;
  }

  // installTemplate => registra el flujo en la tienda y, con n8n configurado, lo crea y activa allá (sin código)
  public async installTemplate(key: string, userId: string): Promise<WorkflowDto> {
    const template = this.template(key);
    const { key: _key, event, ...fields } = template;
    return this.createWorkflow({ ...fields, ...(event ? { event } : {}), active: true, definition: this.n8n.configured ? template.definition : undefined }, userId);
  }

  // ---------- Acciones que llaman los flujos de n8n (RF-20.6 conectar acciones con servicios) ----------
  // whatsappAction => WhatsApp a un cliente (celular verificado) con el proveedor de la tienda (Cloud API o log)
  public async whatsappAction(userId: string, text: string): Promise<{ sent: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
    if (!user?.phone || !user.phoneVerifiedAt) return { sent: false };
    await whatsappProvider.send(user.phone, text);
    return { sent: true };
  }

  public async notifyStaff(title: string, body: string): Promise<{ notified: number }> {
    const admins = await prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true } });
    await notificationService.broadcast(admins.map((admin) => admin.id), { type: "SYSTEM", message: { title, body }, channels: ["IN_APP"] });
    return { notified: admins.length };
  }

  public async dispatchCampaigns(): Promise<{ dispatched: unknown }> {
    return { dispatched: await marketingService.dispatchDue() };
  }

  // ---------- RF-20.7 salud y versiones ----------
  public health(days: number): Promise<AutomationHealthDto> {
    return this.repository.health(days);
  }

  public async versions(id: string): Promise<WorkflowVersionDto[]> {
    await this.find(id);
    return this.repository.versions(id);
  }

  // rollback => restaura una versión anterior (queda como versión nueva: el historial nunca se reescribe)
  public async rollback(id: string, version: number, userId: string): Promise<WorkflowDto> {
    const target = (await this.repository.versions(id)).find((row) => row.version === version);
    if (!target) throw new UnprocessableException(`No existe la versión ${version}`, "VERSION_NOT_FOUND");
    return this.updateWorkflow(id, target.snapshot as UpdateWorkflowInput, userId);
  }

  private async find(id: string): Promise<WorkflowRow> {
    const row = await this.repository.findById(id);
    if (!row) throw new WorkflowNotFoundException(id);
    return row;
  }

  // startRun => registra la ejecución y lanza el comando en segundo plano ("void": no se espera)
  private async startRun(workflow: WorkflowRow, trigger: TriggerType, body: unknown): Promise<ExecutionStatusDto> {
    const run = await this.repository.createRun(workflow.id, trigger);
    void this.execute(run, workflow.webhookPath, body);
    return run;
  }

  // execute => Command con reintentos y backoff exponencial; siempre cierra la bitácora (éxito o fallo)
  private async execute(run: ExecutionStatusDto, webhookPath: string, body: unknown): Promise<void> {
    const startedAt = Date.now();
    let attempts = 0;
    let lastError: unknown = null;
    let httpStatus: number | null = null;
    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      try {
        httpStatus = await this.n8n.callWebhook(webhookPath, body);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        httpStatus = error instanceof AxiosError ? (error.response?.status ?? null) : null;
        if (!retryable(error) || attempts >= MAX_ATTEMPTS) break;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempts - 1)); // 500 ms, 1000 ms...
      }
    }
    const error = lastError ? describe(lastError) : null;
    if (error) logger.warn("automation_run_failed", { runId: run.id, workflowId: run.workflowId, attempts, error });
    await this.repository
      .finishRun(run, { status: error ? "FAILED" : "SUCCESS", attempts, durationMs: Date.now() - startedAt, httpStatus, error })
      .catch((finishError: unknown) => logger.error("automation_run_log_failed", { runId: run.id, error: finishError }));
  }
}

export const automationService = new AutomationService(automationRepository);
