// blockchain.dto.ts (Zod + ethers v6) => TransactionRequest, BalanceResponse y ContractCallRequest.
// Patrón DTO: valida en runtime y deriva el tipo (DRY). Las direcciones se normalizan a checksum EIP-55.
import { getAddress, isAddress } from "ethers";
import { z } from "zod";
import { CHAIN_KEYS, defaultChain } from "../config/chain.config";
import { IdempotencyKeySchema } from "../../gateway/dto/gateway.dto";

// AddressSchema => dirección EVM válida -> forma checksum (evita duplicados por mayúsculas/minúsculas)
export const AddressSchema = z.string().refine((value) => isAddress(value), { message: "Dirección EVM inválida" }).transform((value) => getAddress(value));
export const ChainSchema = z.enum(CHAIN_KEYS).default(defaultChain);

// BalanceQuery => GET /api/v1/rt/blockchain/balance/:id?chain=&token= (":id" = dirección)
export const BalanceQuerySchema = z.object({ chain: ChainSchema, token: AddressSchema.optional() });
export type BalanceQuery = z.infer<typeof BalanceQuerySchema>;

// Cantidad decimal en unidades "humanas" (1.5 ETH, 20 USDC); máximo 18 decimales (precisión de un uint256 en wei)
const AmountSchema = z.string().regex(/^\d{1,30}(\.\d{1,18})?$/, { message: "amount: número decimal positivo" });

// TransactionRequest => POST /api/v1/rt/blockchain/transaction (moneda nativa, o ERC-20 si llega "token")
export const TransactionRequestSchema = z.object({ chain: ChainSchema, to: AddressSchema, amount: AmountSchema, token: AddressSchema.optional(), idempotencyKey: IdempotencyKeySchema });
export type TransactionRequest = z.infer<typeof TransactionRequestSchema>;

// ContractCallRequest => POST /api/v1/rt/blockchain/contract/:id/call (":id" = dirección del contrato)
export const ContractCallRequestSchema = z.object({
  chain: ChainSchema,
  standard: z.enum(["erc20", "erc721"]),
  method: z.string().regex(/^[a-zA-Z]{2,40}$/),
  args: z.array(z.union([z.string().max(500), z.number(), z.boolean()])).max(6).default([]),
  idempotencyKey: IdempotencyKeySchema.optional(), // Obligatoria solo para métodos de escritura (lo valida el service)
});
export type ContractCallRequest = z.infer<typeof ContractCallRequestSchema>;

// BalanceResponse => saldo nativo o de token (raw = entero en la unidad mínima, como texto: uint256 no cabe en number)
export interface BalanceResponse {
  readonly address: string;
  readonly chain: string;
  readonly token: string | null;
  readonly symbol: string;
  readonly decimals: number;
  readonly raw: string;
  readonly formatted: string;
}

// ContractReadResponse => resultado de una función "view" (BigInt serializado como texto)
export interface ContractReadResponse {
  readonly method: string;
  readonly result: unknown;
}
