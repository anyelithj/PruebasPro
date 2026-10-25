// [DRY] única fuente de verdad Ethereum — address 0x (EIP-55), balances, gas, tx_hash.
import { z } from 'zod';

// Dirección Ethereum: 0x + 40 hex.
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección Ethereum inválida');

// Entrada del agente Ethereum.
export const ethereumChatSchema = z.object({
  message: z.string().min(1).max(2000),
  walletAddress: ethereumAddressSchema.optional(),
});
export type EthereumChatInput = z.infer<typeof ethereumChatSchema>;

// Respuesta estructurada unaria del agente Ethereum.
export const ethereumResponseSchema = z.object({
  status: z.string(),
  chain: z.literal('ethereum'),
  toolUsed: z.string().optional(),
  agentResponse: z.string().optional(),
  toolResult: z.unknown().optional(),
  txHash: z.string().nullable().optional(),
  gasUsed: z.number().nullable().optional(),
  network: z.string().optional(),
  explorerUrl: z.string().nullable().optional(),
  timestamp: z.string().optional(),
});
export type EthereumResponse = z.infer<typeof ethereumResponseSchema>;
