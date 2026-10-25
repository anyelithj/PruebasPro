// [DRY] Zod schema — petición al agente blockchain: message, chain, wallet, tool
import { z } from 'zod';

export const blockchainRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  chain: z.enum(['solana', 'ethereum']),
  wallet: z.string().max(64).optional(),
  tool: z.string().max(40).optional(),
});

export type BlockchainRequestDto = z.infer<typeof blockchainRequestSchema>;
