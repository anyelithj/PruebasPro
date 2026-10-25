// whatsapp.provider.ts (Express · TypeScript) => puerto de envío de WhatsApp + implementaciones (RF-16.1, RF-20.2).
// Patrones: Strategy (proveedores intercambiables detrás de WhatsAppProvider), Factory Function (buildWhatsAppProvider
// elige según la configuración) y Adapter (MetaWhatsAppProvider traduce "send(to, text)" a la WhatsApp Cloud API).
// Paradigma: POO (clases con un contrato común) + funcional (la fábrica es una función pura de la configuración).
// Sin SDK: la Cloud API es un POST JSON con Bearer token => axios (ya instalado) basta (0 dependencias nuevas).
import axios from "axios"; // Cliente HTTP del proyecto (timeouts y errores tipados)
import { appConfig } from "../../../config/app.config"; // Variables de entorno validadas con Zod
import { logger } from "../../../shared/middleware/logger.middleware"; // Logger estructurado (winston)

// "interface" => contrato de cada transporte de WhatsApp (DIP: notificaciones y automatización dependen de esto)
export interface WhatsAppProvider {
  readonly name: string;
  send(to: string, text: string): Promise<void>;
}

// toWaNumber => WhatsApp exige el número E.164 SIN "+" ni espacios (función pura)
export const toWaNumber = (phone: string) => phone.replace(/[^\d]/g, "");

// MetaWhatsAppProvider => Adapter de la WhatsApp Business Cloud API (graph.facebook.com/<versión>/<phone-id>/messages).
// Fuera de la ventana de 24 h Meta solo permite PLANTILLAS aprobadas: si hay WHATSAPP_TEMPLATE se envía la plantilla
// con el texto como único parámetro {{1}}; si no, mensaje de texto libre (válido dentro de la ventana o en pruebas).
export class MetaWhatsAppProvider implements WhatsAppProvider {
  public readonly name = "meta";
  constructor(
    private readonly phoneNumberId: string,
    private readonly token: string,
    private readonly template: string | undefined,
    private readonly version: string
  ) {}

  public async send(to: string, text: string): Promise<void> {
    const body = this.template
      ? { messaging_product: "whatsapp", to: toWaNumber(to), type: "template", template: { name: this.template, language: { code: "es" }, components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }] } }
      : { messaging_product: "whatsapp", to: toWaNumber(to), type: "text", text: { body: text.slice(0, 4096), preview_url: true } };
    await axios.post(`https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`, body, {
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 8000, // Un proveedor lento no debe frenar la entrega por los demás canales
    });
  }
}

// LogWhatsAppProvider => alternativa GRATUITA de desarrollo: escribe el mensaje en el log (sin cuenta de Meta)
export class LogWhatsAppProvider implements WhatsAppProvider {
  public readonly name = "log";
  public async send(to: string, text: string): Promise<void> {
    logger.info("whatsapp_log_only", { to, text });
  }
}

// buildWhatsAppProvider => Factory: Cloud API si hay número y token; si no, el proveedor de log
export function buildWhatsAppProvider(config: Pick<typeof appConfig, "WHATSAPP_PHONE_NUMBER_ID" | "WHATSAPP_TOKEN" | "META_ACCESS_TOKEN" | "WHATSAPP_TEMPLATE" | "META_GRAPH_VERSION">): WhatsAppProvider {
  const token = config.WHATSAPP_TOKEN ?? config.META_ACCESS_TOKEN; // "??" => el token de página sirve si tiene el permiso whatsapp_business_messaging
  return config.WHATSAPP_PHONE_NUMBER_ID && token ? new MetaWhatsAppProvider(config.WHATSAPP_PHONE_NUMBER_ID, token, config.WHATSAPP_TEMPLATE, config.META_GRAPH_VERSION) : new LogWhatsAppProvider();
}

// Instancia Singleton del proceso
export const whatsappProvider: WhatsAppProvider = buildWhatsAppProvider(appConfig);
