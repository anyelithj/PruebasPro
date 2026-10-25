import { sepolia } from 'viem/chains';
// [Redes permitidas · core/web3]: SOLO Sepolia (testnet, ETH sin valor real) — misma red que valida NestJS (web3.config.ts) | [Patrón]: Configuration Object + SSOT | [Principio]: Fail Fast (otra red = la UI pide cambiarla) | [Paradigma]: Declarativo
// [Tecnología]: viem/chains (id 11155111, nombre, moneda y exploradores)

export const APP_CHAIN = sepolia;
export const ALLOWED_CHAIN_IDS: readonly number[] = [sepolia.id];

// [explorerTxUrl]: enlace a Etherscan de Sepolia para que el usuario verifique la transacción por su cuenta
export const explorerTxUrl = (hash: string): string => `${sepolia.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddressUrl = (address: string): string => `${sepolia.blockExplorers.default.url}/address/${address}`;
