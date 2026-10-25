import { z } from 'zod';
// [Configuración Web3 · Sprints 7.5/7.6]: RPC de Sepolia, cuenta de la plataforma, confirmaciones mínimas y tasa fija de demostración validadas con Zod al arrancar | [Patrón]: Configuration Object + Parse, don't validate | [Principio]: Fail Fast + SSOT (un solo lugar lee WEB3_*) | [Paradigma]: Funcional
// [Modos]: sin WEB3_RPC_URL → Web3 desactivado (503) · con RPC + dirección → pago con ETH de prueba · con RPC + clave privada → además anclaje de hashes de certificados
// [Seguridad]: SOLO Sepolia (testnet, sin valor real) · la clave privada nunca se registra ni se devuelve; los errores nombran la variable, no su valor

const SEPOLIA_CHAIN_ID = 11155111; // [Red única permitida]: chainId de Sepolia (EIP-155)
const hex = (len: number) => new RegExp(`^0x[0-9a-fA-F]{${len}}$`);

const Web3Schema = z.object({
  WEB3_RPC_URL: z.url().optional(), // Alchemy/Infura/endpoint público de Sepolia
  WEB3_PLATFORM_PRIVATE_KEY: z
    .string()
    .regex(hex(64), 'clave privada inválida (0x + 64 hex)')
    .optional(),
  WEB3_PLATFORM_ADDRESS: z
    .string()
    .regex(hex(40), 'dirección EVM inválida')
    .optional(), // Si falta, se deriva de la clave privada
  WEB3_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(64).default(2),
  // [Tasa de demostración]: wei por centavo de USD (1e12 → 19,99 USD = 0,001999 ETH de prueba)
  WEB3_DEMO_WEI_PER_CENT: z
    .string()
    .regex(/^\d{1,30}$/)
    .default('1000000000000'),
  WEB3_PAYMENT_TTL_MIN: z.coerce.number().int().min(5).max(1440).default(30),
  FRONTEND_URL: z.url().default('http://localhost:9000'), // Dominio que firma el mensaje SIWE (EIP-4361)
});

export interface Web3Config {
  enabled: boolean; // RPC configurado
  chainId: number;
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  platformAddress?: `0x${string}`;
  minConfirmations: number;
  weiPerCent: bigint;
  paymentTtlMs: number;
  siweDomain: string; // host:puerto del shell (p. ej. localhost:9000)
  siweUri: string;
}

export function loadWeb3Config(
  env: NodeJS.ProcessEnv = process.env,
): Web3Config {
  const defined = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== ''),
  );
  const result = Web3Schema.safeParse(defined);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(`Configuración Web3 inválida → ${issues.join(' · ')}`);
  }
  const c = result.data;
  const url = new URL(c.FRONTEND_URL);
  return {
    enabled: !!c.WEB3_RPC_URL,
    chainId: SEPOLIA_CHAIN_ID,
    rpcUrl: c.WEB3_RPC_URL,
    privateKey: c.WEB3_PLATFORM_PRIVATE_KEY as `0x${string}` | undefined,
    platformAddress: c.WEB3_PLATFORM_ADDRESS as `0x${string}` | undefined,
    minConfirmations: c.WEB3_MIN_CONFIRMATIONS,
    weiPerCent: BigInt(c.WEB3_DEMO_WEI_PER_CENT), // `BigInt` (ES2020): los montos en wei superan Number.MAX_SAFE_INTEGER
    paymentTtlMs: c.WEB3_PAYMENT_TTL_MIN * 60_000,
    siweDomain: url.host,
    siweUri: url.origin,
  };
}

// [web3Config]: memo por proceso | [Patrón]: Lazy Singleton
let cached: Web3Config | undefined;
export function web3Config(): Web3Config {
  return (cached ??= loadWeb3Config());
}

// [validateWeb3Env]: gancho `validate` de ConfigModule → no arranca con variables mal puestas | [Principio]: Fail Fast
export function validateWeb3Env(
  env: Record<string, unknown>,
): Record<string, unknown> {
  loadWeb3Config(env as NodeJS.ProcessEnv);
  return env;
}
