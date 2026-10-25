// azure.provider.ts => proveedor OPCIONAL: Azure Communication Services Email.
// Solo se usa con AZURE_ENABLED=true + AZURE_COMMUNICATION_CONNECTION_STRING + AZURE_EMAIL_SENDER;
// si falla, FailoverEmailProvider pasa al SMTP gratuito.
import type { EmailClient } from "@azure/communication-email";
import type { EmailContent } from "../util/template.util";
import type { EmailProvider } from "./email.provider";

export class AzureEmailProvider implements EmailProvider {
  public readonly name = "azure-communication-services";
  private client: EmailClient | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly senderAddress: string // Dominio verificado en el recurso de Azure (ej. DoNotReply@<dominio>)
  ) {}

  // getClient => "await import": el SDK solo se carga si este proveedor se usa realmente
  private async getClient(): Promise<EmailClient> {
    if (!this.client) {
      const { EmailClient: Client } = await import("@azure/communication-email");
      this.client = new Client(this.connectionString);
    }
    return this.client;
  }

  public async send(to: string, content: EmailContent): Promise<void> {
    const client = await this.getClient();
    // "beginSend" devuelve un poller (operación de larga duración); se espera el resultado final
    const poller = await client.beginSend({
      senderAddress: this.senderAddress,
      content: { subject: content.subject, html: content.html, plainText: content.text },
      recipients: { to: [{ address: to }] },
      // Azure exige los adjuntos en base64 (RF-11.2)
      ...(content.attachments?.length ? { attachments: content.attachments.map((file) => ({ name: file.filename, contentType: file.contentType, contentInBase64: file.content.toString("base64") })) } : {}),
    });
    const result = await poller.pollUntilDone();
    if (result.status !== "Succeeded") throw new Error(`Azure Email respondió ${result.status}`);
  }
}
