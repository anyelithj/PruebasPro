import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
// [Modelo Web3 · Dominio]: billetera vinculada, reto SIWE y pago cripto (contrato de /api/web3/*) + reglas puras | [Patrón]: Schema-First (Zod) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Montos]: `amountWei` llega como texto decimal → se convierte a bigint solo al enviar la transacción (sin pérdida de precisión)

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const WalletSchema = z.object({ id: z.string(), address, chainId: z.number().int(), linkedAt: z.string() });
export type LinkedWallet = z.infer<typeof WalletSchema>;

export const SiweChallengeSchema = z.object({ nonce: z.string().min(8), domain: z.string(), uri: z.string(), chainId: z.number().int(), statement: z.string() });
export type SiweChallenge = z.infer<typeof SiweChallengeSchema>;

export const CRYPTO_STATUSES = ['pending', 'confirming', 'paid', 'failed', 'expired'] as const;
export type CryptoStatus = (typeof CRYPTO_STATUSES)[number];

export const CryptoPaymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  walletAddress: address,
  toAddress: address,
  chainId: z.number().int(),
  amountWei: z.string().regex(/^\d+$/),
  status: z.enum(CRYPTO_STATUSES),
  txHash: z.string().nullable(),
  confirmations: z.number().int(),
  error: z.string().nullable(),
  expiresAt: z.string(),
});
export type CryptoPayment = z.infer<typeof CryptoPaymentSchema>;

// [Evento en vivo]: `crypto-payment` de GET /api/events
export const CryptoProgressSchema = z.object({ id: z.string(), status: z.enum(CRYPTO_STATUSES), confirmations: z.number().int(), error: z.string().nullable() });
export type CryptoProgress = z.infer<typeof CryptoProgressSchema>;

// [applyProgress]: mezcla el evento en el pago mostrado (ignora eventos de otros pagos) | inmutable
export const applyProgress = (p: CryptoPayment, e: CryptoProgress): CryptoPayment => (e.id === p.id ? { ...p, status: e.status, confirmations: e.confirmations, error: e.error } : p);

// [shortAddress]: 0x1234…abcd para pantallas estrechas (la dirección completa va en `title`/aria-label)
export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const sameAddress = (a?: string | null, b?: string | null): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();
