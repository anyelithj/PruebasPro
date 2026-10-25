// ai-pipeline.spec.ts (Jest) => funciones PURAS del pipeline de IA de la Fase 6: ranking de recomendaciones y
// detección de clústeres del grafo de productos. Sin base de datos, sin Ollama, sin red.
// "jest.mock" (se eleva al inicio) => no se cargan la configuración ni los repositorios reales (que leen el entorno)
jest.mock("../../src/config/app.config", () => ({ appConfig: { LLM_MAX_TOKENS: 256 }, isProduction: false }));
jest.mock("../../src/module/graph-analysis/repository/graph.repository", () => ({ graphRepository: {} }));

import { rankCandidates } from "../../src/module/recommendation/ml/recommendation.ml";
import { connectedComponents } from "../../src/module/graph-analysis/ml/graph.ml";

describe("rankCandidates", () => {
  it("pondera por estrategia, excluye semillas y respeta el límite", () => {
    const result = rankCandidates(
      {
        CO_PURCHASE: [{ productId: "a", score: 10 }, { productId: "seed", score: 9 }],
        CATEGORY: [{ productId: "b", score: 5 }, { productId: "a", score: 1 }],
        POPULAR: [{ productId: "c", score: 3 }],
      },
      new Set(["seed"]),
      2
    );
    // a = 3·(10/10) + 2·(1/5) = 3,4 | b = 2·(5/5) = 2 | c = 1 => top 2: a, b
    expect(result.productIds).toEqual(["a", "b"]);
    expect(result.strategies).toEqual(["CO_PURCHASE", "CATEGORY", "POPULAR"]);
  });

  it("omite estrategias vacías", () => {
    expect(rankCandidates({ CO_PURCHASE: [], POPULAR: [{ productId: "x", score: 1 }] }, new Set(), 5)).toEqual({ productIds: ["x"], strategies: ["POPULAR"] });
  });
});

describe("connectedComponents", () => {
  it("agrupa productos conectados por co-compra en el mismo clúster", () => {
    const groups = connectedComponents([
      { source: "a", target: "b", weight: 3 },
      { source: "b", target: "c", weight: 2 },
      { source: "x", target: "y", weight: 5 },
    ]);
    expect(groups.get("a")).toBe(groups.get("c"));
    expect(groups.get("x")).toBe(groups.get("y"));
    expect(groups.get("a")).not.toBe(groups.get("x"));
    expect(new Set(groups.values()).size).toBe(2);
  });
});
