// mcp.route.ts => transacciones MCP (montado en /api/v1/mcp): operaciones críticas, solo administradores.
import { Router } from "express";
import { mcpController } from "../controller/mcp.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const mcpRouter = Router();
mcpRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

mcpRouter.post("/", rateLimit({ bucket: "mcp-transaction", limit: 30, windowSeconds: 60 }), mcpController.createMCPTransaction);
mcpRouter.get("/", mcpController.listMCPTransactions);
mcpRouter.get("/:id", mcpController.getMCPTransactionById);
mcpRouter.delete("/:id", mcpController.deleteMCPTransactionById);
mcpRouter.post("/:id/rollback", mcpController.createSagaCompensation);
