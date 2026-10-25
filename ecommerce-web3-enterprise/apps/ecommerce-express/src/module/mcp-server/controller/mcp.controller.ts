// mcp.controller.ts => capa HTTP del módulo MCP Server: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { mcpService } from "../service/mcp.service";
import { ListTransactionsQuerySchema, RollbackSchema, TransactionSchema } from "../schema/mcp.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class McpController {
  // POST /api/v1/mcp => 201 transacción nueva | 200 misma idempotencyKey (ya existía)
  public readonly createMCPTransaction = asyncHandler(async (req: Request, res: Response) => {
    const { transaction, created } = await mcpService.createMCPTransaction(TransactionSchema.parse(req.body), currentUser(req).id);
    sendSuccess(res, transaction, created ? HttpStatus.CREATED : HttpStatus.OK);
  });

  // GET /api/v1/mcp?status=&page=
  public readonly listMCPTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await mcpService.listMCPTransactions(ListTransactionsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/mcp/:id
  public readonly getMCPTransactionById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await mcpService.getMCPTransactionById(parseObjectId(req)));
  });

  // DELETE /api/v1/mcp/:id
  public readonly deleteMCPTransactionById = asyncHandler(async (req: Request, res: Response) => {
    await mcpService.deleteMCPTransactionById(parseObjectId(req));
    sendNoContent(res);
  });

  // POST /api/v1/mcp/:id/rollback { reason }
  public readonly createSagaCompensation = asyncHandler(async (req: Request, res: Response) => {
    const { reason } = RollbackSchema.parse(req.body ?? {});
    sendSuccess(res, await mcpService.createSagaCompensation(parseObjectId(req), reason, currentUser(req).id));
  });
}

export const mcpController = new McpController();
