// graph.route.ts => Análisis Relacional IA: solo administradores (analítica interna del negocio).
// Chain of Responsibility de Express: jwtAuthGuard -> requireRoles -> rateLimit -> controller.
import { Router } from "express";
import { graphController } from "../controller/graph.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const graphRouter = Router();
graphRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

// Los análisis (SQL + LLM opcional) son costosos: máximo 20 por minuto por IP
graphRouter.post("/query", rateLimit({ bucket: "graph-query", limit: 20, windowSeconds: 60 }), graphController.createGraphQueryResult);
graphRouter.get("/", graphController.listProductGraphs);
graphRouter.get("/:id/relation", graphController.getProductGraphById);
graphRouter.delete("/:id", graphController.deleteProductGraphById);
