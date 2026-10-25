// email.provider.ts => puerto (interfaz) de envío de correo + proveedor con failover.
// Patrones: Strategy (cada proveedor es intercambiable), Chain of Responsibility (se intenta en orden)
// y Circuit Breaker simple (un proveedor que falla se salta durante un tiempo para no sumar latencia).
import type { EmailContent } from "../util/template.util";

// EmailProvider => contrato que cumple cada transporte (SMTP, Azure Communication Services...)
export interface EmailProvider {
  readonly name: string;
  send(to: string, content: EmailContent): Promise<void>;
}

// Callback de observabilidad: el servicio decide cómo registrar (el proveedor no depende del logger)
export type FailoverListener = (provider: string, error: unknown) => void;

const DEFAULT_COOLDOWN_MS = 5 * 60_000; // 5 min con el circuito "abierto" antes de reintentar un proveedor caído

// FailoverEmailProvider => intenta los proveedores en orden; el último (SMTP gratuito) es la red de seguridad
export class FailoverEmailProvider implements EmailProvider {
  public readonly name = "failover";
  // "Map" nombre -> instante hasta el que el proveedor se considera caído
  private readonly openUntil = new Map<string, number>();

  constructor(
    private readonly providers: readonly EmailProvider[],
    private readonly onFailover: FailoverListener = () => undefined,
    private readonly cooldownMs = DEFAULT_COOLDOWN_MS,
    private readonly now: () => number = Date.now // Reloj inyectable => pruebas deterministas
  ) {
    if (providers.length === 0) throw new Error("Se requiere al menos un proveedor de email");
  }

  public async send(to: string, content: EmailContent): Promise<void> {
    let lastError: unknown;
    for (const [index, provider] of this.providers.entries()) {
      const isLast = index === this.providers.length - 1;
      // El último proveedor se intenta siempre: nunca se deja de enviar por un circuito abierto
      if (!isLast && (this.openUntil.get(provider.name) ?? 0) > this.now()) continue;
      try {
        await provider.send(to, content);
        this.openUntil.delete(provider.name); // Éxito => circuito cerrado
        return;
      } catch (error) {
        lastError = error;
        this.openUntil.set(provider.name, this.now() + this.cooldownMs);
        if (!isLast) this.onFailover(provider.name, error);
      }
    }
    throw lastError;
  }
}
