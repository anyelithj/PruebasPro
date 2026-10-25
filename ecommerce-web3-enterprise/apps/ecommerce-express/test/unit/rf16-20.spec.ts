// rf16-20.spec.ts (Jest) => funciones PURAS de los RF 16-20: número de WhatsApp (RF-16.1), riesgo de abandono
// (RF-18.8), firma de TikTok Shop (RF-19.7), salud de flujos (RF-20.7) y plantillas de n8n (RF-20.2).
import { createHmac } from "node:crypto";
import { toWaNumber } from "../../src/module/notification/provider/whatsapp.provider";
import { classifyChurn } from "../../src/module/crm/service/retention.service";
import { tiktokSign } from "../../src/module/social-commerce/provider/catalog.provider";
import { classifyHealth, percentile } from "../../src/module/automation/repository/automation.repository";
import { WORKFLOW_TEMPLATES } from "../../src/module/automation/model/automation.templates";
import { AUTOMATION_EVENTS } from "../../src/module/automation/model/automation.model";
import { cardsFor, daypart } from "../../src/module/recommendation/service/home-feed.service";

describe("RF-16.1 WhatsApp", () => {
  it("normaliza el celular a E.164 sin '+' ni espacios", () => {
    expect(toWaNumber("+57 300 123 4567")).toBe("573001234567");
  });
});

describe("RF-18.8 riesgo de abandono", () => {
  it("clasifica por días sin comprar frente al ritmo habitual", () => {
    expect(classifyChurn(0.8)).toBe("LOW");
    expect(classifyChurn(1.5)).toBe("MEDIUM");
    expect(classifyChurn(3.2)).toBe("HIGH");
  });
});

describe("RF-19.7 TikTok Shop", () => {
  it("firma = HMAC(secret, secret + path + params ordenados sin sign/access_token + body + secret)", () => {
    const params = { timestamp: "100", app_key: "k", sign: "x", access_token: "t" };
    const expected = createHmac("sha256", "s").update("s/api/testapp_keyktimestamp100{}s").digest("hex");
    expect(tiktokSign("/api/test", params, "{}", "s")).toBe(expected);
  });
});

describe("RF-20.7 salud de flujos", () => {
  it("p95 y clasificación de salud", () => {
    expect(percentile([10, 20, 30, 40, 1000], 0.95)).toBe(1000);
    expect(percentile([], 0.95)).toBe(0);
    expect(classifyHealth(0, 0)).toBe("IDLE");
    expect(classifyHealth(20, 0.97)).toBe("HEALTHY");
    expect(classifyHealth(20, 0.85)).toBe("DEGRADED");
    expect(classifyHealth(20, 0.5)).toBe("FAILING");
  });
});

describe("RF-20.2 plantillas de n8n", () => {
  it("cada plantilla tiene un evento válido (si es EVENT) y nodos conectados en cadena", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      if (template.triggerType === "EVENT") expect(AUTOMATION_EVENTS).toContain(template.event);
      expect(Object.keys(template.definition.connections)).toHaveLength(template.definition.nodes.length - 1);
    }
    expect(new Set(WORKFLOW_TEMPLATES.map((t) => t.key)).size).toBe(WORKFLOW_TEMPLATES.length);
  });
});

describe("RF-18.7 portada por contexto", () => {
  it("franja horaria (la noche cruza la medianoche) y tarjetas por dispositivo", () => {
    expect(daypart(8)).toBe("MORNING");
    expect(daypart(15)).toBe("AFTERNOON");
    expect(daypart(20)).toBe("EVENING");
    expect(daypart(2)).toBe("NIGHT");
    expect(daypart(23)).toBe("NIGHT");
    expect(cardsFor("mobile")).toBe(4);
    expect(cardsFor("desktop")).toBe(8);
  });
});
