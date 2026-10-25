// blockchain.model.ts (Prisma + PostgreSQL) => tabla blockchain_transactions (transacciones nativas y llamadas a contratos),
// migración 20261006000000_phase9_express_hpc. Prisma genera los tipos desde schema.prisma (una sola fuente); aquí se
// re-exportan con el DTO de salida y los ABI mínimos de los contratos estándar.
import type { BlockchainTx, BlockchainTxKind, BlockchainTxStatus } from "@prisma/client";
import { getChain, type ChainKey } from "../config/chain.config";

export type { BlockchainTx, BlockchainTxKind, BlockchainTxStatus };

// ABI mínimos (Interface Segregation): solo las funciones permitidas de ERC-20 y ERC-721.
// "view" => lectura sin firma ni gas; el resto son escrituras (solo ADMIN, con Idempotency-Key)
export const STANDARD_ABIS = {
  erc20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  ],
  erc721: [
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function approve(address to, uint256 tokenId)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function safeMint(address to, string uri) returns (uint256)", // Contrato de badges del proyecto (loyalty)
    "function burn(uint256 tokenId)",
  ],
} as const;

// BlockchainTxDto => fila + enlace al explorador de bloques
export interface BlockchainTxDto extends BlockchainTx {
  readonly explorerUrl: string | null;
}

export function toTxDto(tx: BlockchainTx): BlockchainTxDto {
  return { ...tx, explorerUrl: tx.txHash ? `${getChain(tx.chain as ChainKey).explorerUrl}/tx/${tx.txHash}` : null };
}

// toJsonSafe => BigInt no es serializable por JSON.stringify: se convierte a texto (recursivo y puro)
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  return value;
}
