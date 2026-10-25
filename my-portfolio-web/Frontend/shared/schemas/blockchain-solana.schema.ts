// [DRY] única fuente de verdad Solana — wallet Base58, balances, evento del agente.
import { z } from 'zod';

// Dirección pública Solana en Base58 (32–44 chars, sin 0/O/I/l).
export const solanaAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Dirección Solana inválida');

// Entrada del agente Solana.
export const solanaChatSchema = z.object({
  message: z.string().min(1).max(2000),
  walletAddress: solanaAddressSchema.optional(),
});
export type SolanaChatInput = z.infer<typeof solanaChatSchema>;

// [ISP] evento de streaming del agente blockchain — reutilizado por Ethereum.
export const blockchainEventSchema = z.object({
  type: z.enum(['chunk', 'tool_call', 'tool_result', 'done', 'error']),
  content: z.string().optional(),
  tool: z.string().optional(),
  result: z.unknown().optional(),
});
export type BlockchainEvent = z.infer<typeof blockchainEventSchema>;

// Respuesta estructurada unaria del agente Solana.
export const solanaResponseSchema = z.object({
  status: z.string(),
  chain: z.literal('solana'),
  toolUsed: z.string().optional(),
  agentResponse: z.string().optional(),
  toolResult: z.unknown().optional(),
  txSignature: z.string().nullable().optional(),
  network: z.string().optional(),
  explorerUrl: z.string().nullable().optional(),
  timestamp: z.string().optional(),
});
export type SolanaResponse = z.infer<typeof solanaResponseSchema>;
