// blockchain.handler.ts (Express) => capa HTTP de la integración blockchain (montada en /api/v1/rt/blockchain).
// Lecturas: usuario autenticado (cada lectura cuesta una llamada RPC). Escrituras: solo ADMIN + Idempotency-Key.
// La IA (MCP / LLM) nunca llega aquí: no hay herramienta que firme transacciones. Thin Controller + Adapter.
import { Router, type Request, type Response } from "express";
import { blockchainService } from "../service/blockchain.service";
import { AddressSchema, BalanceQuerySchema, ContractCallRequestSchema, TransactionRequestSchema } from "../dto/blockchain.dto";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { currentUser, isAdmin } from "../../../shared/decorator/auth.decorator";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";

const addressParam = (req: Request) => AddressSchema.parse(req.params["id"]); // ":id" = dirección EVM

export const blockchainRouter = Router();
blockchainRouter.use(jwtAuthGuard);

// GET /api/v1/rt/blockchain/balance/:id?chain=&token= => getBlockchainBalanceById()
blockchainRouter.get(
  "/balance/:id",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await blockchainService.getBalance(addressParam(req), BalanceQuerySchema.parse(req.query)));
  })
);

// POST /api/v1/rt/blockchain/transaction => createBlockchainTx() — 202: queda PENDING hasta el recibo
blockchainRouter.post(
  "/transaction",
  requireRoles(Roles.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const input = TransactionRequestSchema.parse({ ...req.body, idempotencyKey: req.get("Idempotency-Key") });
    sendSuccess(res, await blockchainService.sendTransaction(input, currentUser(req).id), HttpStatus.ACCEPTED);
  })
);

// DELETE /api/v1/rt/blockchain/transaction/:id => deleteBlockchainTxById() (cancelar tx pendiente en la mempool)
blockchainRouter.delete(
  "/transaction/:id",
  requireRoles(Roles.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await blockchainService.cancelTransaction(parseId(req)));
  })
);

// POST /api/v1/rt/blockchain/contract/:id/call => createContractCall() ("view" = cualquier usuario; escritura = ADMIN)
blockchainRouter.post(
  "/contract/:id/call",
  asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const input = ContractCallRequestSchema.parse({ ...req.body, idempotencyKey: req.get("Idempotency-Key") });
    const result = await blockchainService.callContract(addressParam(req), input, { id: user.id, canWrite: isAdmin(user) });
    sendSuccess(res, result, "txHash" in result ? HttpStatus.ACCEPTED : HttpStatus.OK); // "in" => distingue escritura de lectura
  })
);
