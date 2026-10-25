// sms.provider.ts (Express · TypeScript) => puerto de envío de SMS + sus implementaciones (RF-01.1 verificación de teléfono).
// Patrones: Strategy (proveedores intercambiables detrás de la interfaz SmsProvider), Factory Function (buildSmsProvider
// elige según la configuración) y Adapter (TwilioSmsProvider traduce "send(to, body)" a la API REST de Twilio).
// Paradigma: POO (clases que implementan un contrato) + funcional (la fábrica es una función pura de la configuración).
// Sin SDK: la API REST de Twilio es un POST form-urlencoded con Basic Auth => axios (ya instalado) basta (0 dependencias).
import axios from "axios"; // Cliente HTTP del proyecto (timeouts y errores tipados)
import { appConfig } from "../../../config/app.config"; // Variables de entorno validadas con Zod
import { logger } from "../../../shared/middleware/logger.middleware"; // Logger estructurado (winston)

// "interface" => contrato que cumple cada transporte de SMS (DIP: el servicio depende de esta abstracción)
export interface SmsProvider {
  readonly name: string; // "readonly" => no cambia tras construir el objeto
  send(to: string, body: string): Promise<void>; // "Promise<void>" => operación asíncrona sin valor de retorno
}

// TwilioSmsProvider => Adapter de la API REST de Twilio (Messages.json)
export class TwilioSmsProvider implements SmsProvider {
  public readonly name = "twilio";
  // Parámetros "private readonly" en el constructor => declara y asigna las propiedades en una sola línea (TS)
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string
  ) {}

  public async send(to: string, body: string): Promise<void> {
    // "URLSearchParams" (estándar web) => cuerpo application/x-www-form-urlencoded que exige Twilio
    // "MG..." => Messaging Service SID; cualquier otro valor es un número remitente
    const form = new URLSearchParams({ To: to, Body: body, [this.from.startsWith("MG") ? "MessagingServiceSid" : "From"]: this.from });
    await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, form, {
      auth: { username: this.accountSid, password: this.authToken }, // HTTP Basic Auth (SID + token)
      timeout: 5000, // Un proveedor lento no debe colgar la petición del usuario
    });
  }
}

// LogSmsProvider => alternativa GRATUITA de desarrollo: escribe el SMS en el log (como Mailpit con el correo).
// Solo se usa si faltan credenciales; en producción sin Twilio el envío sigue funcionando para pruebas internas.
export class LogSmsProvider implements SmsProvider {
  public readonly name = "log";
  public async send(to: string, body: string): Promise<void> {
    logger.info("sms_log_only", { to, body }); // winston: mensaje + metadatos (sin proveedor configurado)
  }
}

// buildSmsProvider => Factory: Twilio si hay credenciales completas; si no, el proveedor de log
export function buildSmsProvider(config: Pick<typeof appConfig, "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_FROM">): SmsProvider {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = config; // Desestructuración con alias
  return sid && token && from ? new TwilioSmsProvider(sid, token, from) : new LogSmsProvider();
}

// Instancia Singleton del proceso (se crea una vez al importar el módulo)
export const smsProvider: SmsProvider = buildSmsProvider(appConfig);
