// azure-fallback.spec.ts => Azure es opcional: por defecto se usan alternativas gratuitas y, si Azure falla,
// el sistema cae automáticamente al proveedor libre.
import { FailoverEmailProvider, type EmailProvider } from "../../src/module/email/provider/email.provider";
import { isAzureEnabled, loadKeyVaultSecrets, toEnvName } from "../../src/config/azure.config";

process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
process.env["JWT_ACCESS_SECRET"] ??= "test-access-secret-with-enough-length-0000";
process.env["JWT_REFRESH_SECRET"] ??= "test-refresh-secret-with-enough-length-000";

const content = { subject: "Hola", html: "<p>Hola</p>", text: "Hola" };

// fakeProvider => doble de prueba que falla o registra los envíos
function fakeProvider(name: string, fails: boolean): EmailProvider & { sent: string[] } {
  const sent: string[] = [];
  return {
    name,
    sent,
    send: async (to: string) => {
      if (fails) throw new Error(`${name} caído`);
      sent.push(to);
    },
  };
}

describe("FailoverEmailProvider", () => {
  it("usa el respaldo gratuito cuando Azure falla y salta Azure mientras el circuito está abierto", async () => {
    const azure = fakeProvider("azure", true);
    const smtp = fakeProvider("smtp", false);
    const failovers: string[] = [];
    let clock = 0;
    const provider = new FailoverEmailProvider([azure, smtp], (name) => failovers.push(name), 1_000, () => clock);

    await provider.send("a@test.com", content);
    await provider.send("b@test.com", content); // Circuito abierto: Azure no se reintenta
    expect(smtp.sent).toEqual(["a@test.com", "b@test.com"]);
    expect(failovers).toEqual(["azure"]);

    clock = 2_000; // Pasó el tiempo de enfriamiento: Azure se vuelve a intentar
    await provider.send("c@test.com", content);
    expect(failovers).toEqual(["azure", "azure"]);
  });

  it("propaga el error si también falla el último proveedor", async () => {
    const provider = new FailoverEmailProvider([fakeProvider("smtp", true)]);
    await expect(provider.send("a@test.com", content)).rejects.toThrow("smtp caído");
  });
});

describe("Azure desactivado por defecto", () => {
  it("sin AZURE_ENABLED solo se usa SMTP aunque existan credenciales de Azure", async () => {
    const { buildProviders } = await import("../../src/module/email/service/email.service");
    const providers = buildProviders({ AZURE_ENABLED: false, AZURE_COMMUNICATION_CONNECTION_STRING: "endpoint=x", AZURE_EMAIL_SENDER: "no-reply@x.com" });
    expect(providers.map((p) => p.name)).toEqual(["smtp"]);
  });

  it("con AZURE_ENABLED y credenciales, Azure va primero y SMTP queda de respaldo", async () => {
    const { buildProviders } = await import("../../src/module/email/service/email.service");
    const providers = buildProviders({ AZURE_ENABLED: true, AZURE_COMMUNICATION_CONNECTION_STRING: "endpoint=x", AZURE_EMAIL_SENDER: "no-reply@x.com" });
    expect(providers.map((p) => p.name)).toEqual(["azure-communication-services", "smtp"]);
  });

  it("Key Vault no se consulta si Azure está apagado (se usan las variables del .env)", async () => {
    delete process.env["AZURE_ENABLED"];
    process.env["AZURE_KEY_VAULT_URL"] = "https://no-existe.vault.azure.net";
    expect(isAzureEnabled()).toBe(false);
    await expect(loadKeyVaultSecrets()).resolves.toBe("env");
    delete process.env["AZURE_KEY_VAULT_URL"];
  });

  it("convierte nombres de secreto de Key Vault a variables de entorno", () => {
    expect(toEnvName("jwt-access-secret")).toBe("JWT_ACCESS_SECRET");
  });
});
