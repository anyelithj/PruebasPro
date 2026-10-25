// chain.config.ts (TypeScript + ethers v6) => configuración multi-chain EVM: ChainConfig { chainId, rpcUrl, explorerUrl }.
// Factory + Lazy Singleton por cadena: UN provider (y UN signer) por red, creado en el primer uso y reutilizado
// (conexiones HTTP keep-alive). "staticNetwork" evita la llamada eth_chainId de detección en cada arranque y el
// sondeo de red; pollingInterval de 12 s (≈ un bloque de Ethereum) reduce llamadas RPC mientras se espera un recibo.
// Solana: requiere @solana/web3.js (dependencia POR APROBAR); hasta entonces solo cadenas EVM.
import { JsonRpcProvider, Wallet } from "ethers";
import { appConfig } from "../../../config/app.config";
import { ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";

export interface ChainConfig {
  readonly key: string;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly explorerUrl: string;
  readonly nativeSymbol: string;
  readonly testnet: boolean;
}

// RPC públicos y gratuitos (publicnode.com) como respaldo; WEB3_RPC_URLS los reemplaza por nodos propios
const CHAINS = {
  ethereum: { chainId: 1, rpcUrl: "https://ethereum-rpc.publicnode.com", explorerUrl: "https://etherscan.io", nativeSymbol: "ETH", testnet: false },
  sepolia: { chainId: 11155111, rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com", explorerUrl: "https://sepolia.etherscan.io", nativeSymbol: "ETH", testnet: true },
  polygon: { chainId: 137, rpcUrl: "https://polygon-bor-rpc.publicnode.com", explorerUrl: "https://polygonscan.com", nativeSymbol: "POL", testnet: false },
  amoy: { chainId: 80002, rpcUrl: "https://polygon-amoy-bor-rpc.publicnode.com", explorerUrl: "https://amoy.polygonscan.com", nativeSymbol: "POL", testnet: true },
  bsc: { chainId: 56, rpcUrl: "https://bsc-rpc.publicnode.com", explorerUrl: "https://bscscan.com", nativeSymbol: "BNB", testnet: false },
  arbitrum: { chainId: 42161, rpcUrl: "https://arbitrum-one-rpc.publicnode.com", explorerUrl: "https://arbiscan.io", nativeSymbol: "ETH", testnet: false },
  optimism: { chainId: 10, rpcUrl: "https://optimism-rpc.publicnode.com", explorerUrl: "https://optimistic.etherscan.io", nativeSymbol: "ETH", testnet: false },
} as const; // "as const" => claves y valores literales de solo lectura

export type ChainKey = keyof typeof CHAINS; // "ethereum" | "sepolia" | ...
export const CHAIN_KEYS = Object.keys(CHAINS) as [ChainKey, ...ChainKey[]]; // Tupla no vacía (la exige z.enum)

// defaultChain => WEB3_DEFAULT_CHAIN si es una clave válida; si no, sepolia (testnet)
export const defaultChain: ChainKey = (CHAIN_KEYS as readonly string[]).includes(appConfig.WEB3_DEFAULT_CHAIN) ? (appConfig.WEB3_DEFAULT_CHAIN as ChainKey) : "sepolia";

export function getChain(key: ChainKey): ChainConfig {
  return { key, ...CHAINS[key], rpcUrl: appConfig.WEB3_RPC_URLS[key] ?? CHAINS[key].rpcUrl };
}

const providers = new Map<ChainKey, JsonRpcProvider>();
const signers = new Map<ChainKey, Wallet>();

// getProvider => Factory con caché: una instancia por cadena
export function getProvider(key: ChainKey): JsonRpcProvider {
  let provider = providers.get(key);
  if (!provider) {
    const chain = getChain(key);
    provider = new JsonRpcProvider(chain.rpcUrl, chain.chainId, { staticNetwork: true });
    provider.pollingInterval = 12_000;
    providers.set(key, provider);
  }
  return provider;
}

// getSigner => cuenta del backend. La clave privada SOLO sale de WEB3_PRIVATE_KEY (o Key Vault): nunca viaja por la API
// y ningún modelo de IA tiene acceso a esta función (solo el handler, detrás de requireRoles(ADMIN))
export function getSigner(key: ChainKey): Wallet {
  if (!appConfig.WEB3_PRIVATE_KEY) throw new ServiceUnavailableException("Firma no configurada (WEB3_PRIVATE_KEY)");
  let signer = signers.get(key);
  if (!signer) {
    signer = new Wallet(appConfig.WEB3_PRIVATE_KEY, getProvider(key));
    signers.set(key, signer);
  }
  return signer;
}
