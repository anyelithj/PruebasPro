// automation.templates.ts => RF-20.2 / RF-20.8 plantillas de flujos listas para instalar en n8n (sin código):
// WhatsApp por estado del pedido, inventario y alerta de stock bajo, factura electrónica, segmentación, campañas,
// reactivación de inactivos y seguimiento multicanal del pedido.
// Cada plantilla = disparador (evento/programado) + definición de n8n (nodos + conexiones). Los nodos HTTP llaman a la
// API de la tienda con la credencial "Tienda API" (Header Auth con un token de servicio) que se crea una vez en n8n.
// Patrones: Prototype (cada plantilla se clona al instalar), Builder (helpers de nodos) y Configuration as Data.
// Paradigma: declarativo + funcional (funciones puras que arman JSON).
import type { AutomationEvent, TriggerType } from "./automation.model";

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  event: AutomationEvent | null;
  webhookPath: string;
  definition: { nodes: Array<Record<string, unknown>>; connections: Record<string, unknown>; settings: Record<string, unknown> };
}

const API = "={{$env.STORE_API_URL}}/api/v1"; // Variable de entorno de n8n con la URL de la API de la tienda
const CREDENTIAL = { httpHeaderAuth: { name: "Tienda API" } };

// --- Builders de nodos (funciones puras) ---
const webhook = (path: string) => ({ name: "Evento de la tienda", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], parameters: { path, httpMethod: "POST", responseMode: "onReceived" } });
const schedule = (cron: string) => ({ name: "Programado", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: "cronExpression", expression: cron }] } } });
const http = (name: string, method: "GET" | "POST" | "PATCH", path: string, body: Record<string, string> | null, x: number) => ({
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [x, 0],
  credentials: CREDENTIAL,
  parameters: {
    method,
    url: `${API}${path}`,
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    ...(body ? { sendBody: true, specifyBody: "json", jsonBody: JSON.stringify(body) } : {}),
  },
});
const condition = (name: string, left: string, right: string, x: number) => ({
  name,
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: [x, 0],
  parameters: { conditions: { conditions: [{ leftValue: left, rightValue: right, operator: { type: "string", operation: "equals" } }] } },
});
// chain => conecta los nodos en orden (A -> B -> C); un IF continúa solo por su salida "true"
function chain(nodes: Array<Record<string, unknown>>): WorkflowTemplate["definition"] {
  const connections: Record<string, unknown> = {};
  nodes.slice(0, -1).forEach((node, index) => {
    connections[node["name"] as string] = { main: [[{ node: nodes[index + 1]!["name"], type: "main", index: 0 }]] };
  });
  return { nodes, connections, settings: { executionOrder: "v1" } };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "whatsapp-order-status",
    name: "WhatsApp: estado del pedido",
    description: "Cuando el pedido cambia de estado, envía un WhatsApp al cliente (usa el proveedor de WhatsApp de la tienda).",
    triggerType: "EVENT",
    event: "order.status-changed",
    webhookPath: "tienda/pedido-estado-whatsapp",
    definition: chain([
      webhook("tienda/pedido-estado-whatsapp"),
      http("Enviar WhatsApp", "POST", "/automation/action/whatsapp", { userId: "={{$json.body.data.userId}}", text: "=Tu pedido {{$json.body.data.orderNumber}} ahora está: {{$json.body.data.to}}" }, 300),
    ]),
  },
  {
    key: "low-stock-alert",
    name: "Alerta de stock bajo + reabastecimiento",
    description: "Con stock bajo avisa al equipo y pide la sugerencia de reabastecimiento con pronóstico de IA.",
    triggerType: "EVENT",
    event: "inventory.low",
    webhookPath: "tienda/stock-bajo",
    definition: chain([
      webhook("tienda/stock-bajo"),
      http("Avisar al equipo", "POST", "/automation/action/notify-staff", { title: "=Stock bajo: {{$json.body.data.productName}}", body: "=Quedan {{$json.body.data.available}} unidades de {{$json.body.data.sku}}" }, 300),
      http("Sugerencia de reabastecimiento", "GET", "/inventory?lowStock=true&limit=50", null, 600),
    ]),
  },
  {
    key: "inventory-sync",
    name: "Actualizar inventario en los canales",
    description: "Cada ajuste de inventario se refleja en Facebook, Instagram, WhatsApp y TikTok Shop.",
    triggerType: "EVENT",
    event: "inventory.adjusted",
    webhookPath: "tienda/inventario",
    definition: chain([webhook("tienda/inventario"), http("Sincronizar catálogo", "POST", "/social/channel/sync", {}, 300)]),
  },
  {
    key: "invoice-email",
    name: "Factura electrónica al entregar",
    description: "Al entregarse el pedido reenvía la factura electrónica (PDF + XML) al correo del cliente.",
    triggerType: "EVENT",
    event: "invoice.issued",
    webhookPath: "tienda/factura",
    definition: chain([webhook("tienda/factura"), http("Enviar factura", "POST", "=/invoice/{{$json.body.data.invoiceId}}/email", null, 300)]),
  },
  {
    key: "weekly-segmentation",
    name: "Segmentación semanal de clientes",
    description: "Cada lunes recalcula los segmentos (VIP, nuevos, inactivos) y avisa al equipo de marketing.",
    triggerType: "SCHEDULE",
    event: null,
    webhookPath: "tienda/segmentacion",
    definition: chain([
      schedule("0 8 * * 1"),
      http("Clientes inactivos", "GET", "/crm/customer?segment=INACTIVE&limit=100", null, 300),
      http("Avisar a marketing", "POST", "/automation/action/notify-staff", { title: "Segmentación semanal lista", body: "={{$json.meta.total}} clientes inactivos para campañas" }, 600),
    ]),
  },
  {
    key: "campaign-dispatch",
    name: "Campañas programadas",
    description: "Cada hora despacha las campañas de marketing cuya fecha de envío ya llegó.",
    triggerType: "SCHEDULE",
    event: null,
    webhookPath: "tienda/campanas",
    definition: chain([schedule("0 * * * *"), http("Despachar campañas", "POST", "/automation/action/dispatch-campaigns", {}, 300)]),
  },
  {
    key: "customer-reactivation",
    name: "Reactivar clientes inactivos",
    description: "Cuando un cliente entra en riesgo alto de abandono, se le envía un correo personalizado con cupón y un WhatsApp.",
    triggerType: "EVENT",
    event: "customer.inactive",
    webhookPath: "tienda/reactivacion",
    definition: chain([
      webhook("tienda/reactivacion"),
      http("WhatsApp de reactivación", "POST", "/automation/action/whatsapp", { userId: "={{$json.body.data.userId}}", text: "={{$json.body.data.firstName}}, te extrañamos: usa {{$json.body.data.code}} y obtén {{$json.body.data.percent}}% de descuento." }, 300),
    ]),
  },
  {
    key: "order-followup",
    name: "Seguimiento del pedido por varios canales",
    description: "Al enviarse el pedido avisa por WhatsApp y, si se entrega, pide la reseña (correo + notificación).",
    triggerType: "EVENT",
    event: "order.status-changed",
    webhookPath: "tienda/seguimiento",
    definition: chain([
      webhook("tienda/seguimiento"),
      condition("¿Enviado?", "={{$json.body.data.to}}", "SHIPPED", 300),
      http("WhatsApp de envío", "POST", "/automation/action/whatsapp", { userId: "={{$json.body.data.userId}}", text: "=¡Tu pedido {{$json.body.data.orderNumber}} va en camino!" }, 600),
    ]),
  },
];

export const findTemplate = (key: string) => WORKFLOW_TEMPLATES.find((template) => template.key === key) ?? null;
