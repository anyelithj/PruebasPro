import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { createWalletClient, custom, type EIP1193Provider, type WalletClient } from 'viem';
import { APP_CHAIN } from './chains';
// [ViemClient · core/web3]: cliente viem compartido — descubre billeteras (EIP-6963), conecta, cambia a Sepolia, firma mensajes SIWE y envía transacciones | [Patrón]: Singleton (root) + Adapter (EIP-1193 → viem) + Observer (eventos `eip6963:announceProvider`) | [Principio]: SRP + DIP (las funcionalidades no tocan `window.ethereum`) | [Paradigma]: Reactivo (signals) + async/await
// [Seguridad]: las claves privadas NUNCA salen de la billetera del usuario; aquí solo se piden firmas y envíos que él aprueba

// [EIP-6963]: detalle que anuncia cada extensión instalada (MetaMask, Rabby, Coinbase…) | evita pelearse por `window.ethereum`
export interface WalletProviderInfo {
  uuid: string;
  name: string;
  icon: string; // data URI (SVG/PNG) que publica la billetera
  rdns: string;
}
export interface DiscoveredWallet {
  info: WalletProviderInfo;
  provider: EIP1193Provider;
}

@Injectable({ providedIn: 'root' })
export class ViemClient {
  readonly wallets = signal<DiscoveredWallet[]>([]);
  readonly account = signal<`0x${string}` | null>(null);
  readonly connectedWith = signal<WalletProviderInfo | null>(null);
  private client: WalletClient | null = null;

  constructor() {
    // `CustomEvent<…>` (DOM): cada billetera responde a `eip6963:requestProvider` anunciándose | dedupe por uuid
    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent<DiscoveredWallet>).detail;
      if (!detail?.info?.uuid || this.wallets().some((w) => w.info.uuid === detail.info.uuid)) return;
      this.wallets.update((list) => [...list, detail]);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('eip6963:announceProvider', onAnnounce));
    this.discover();
  }

  // [discover]: pide a las extensiones que se anuncien (se puede repetir: «Buscar de nuevo»)
  discover(): void {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  // [connect]: pide permiso a la billetera, fija la cuenta y cambia a Sepolia si hace falta
  async connect(wallet: DiscoveredWallet): Promise<`0x${string}`> {
    const client = createWalletClient({ chain: APP_CHAIN, transport: custom(wallet.provider) });
    const [address] = await client.requestAddresses(); // `eth_requestAccounts` → ventana de la billetera
    if (!address) throw new Error('La billetera no compartió ninguna cuenta');
    if ((await client.getChainId()) !== APP_CHAIN.id) {
      // `switchChain` (viem): `wallet_switchEthereumChain`; si la red no existe en la billetera se añade
      await client.switchChain({ id: APP_CHAIN.id }).catch(() => client.addChain({ chain: APP_CHAIN }));
    }
    this.client = client;
    this.account.set(address);
    this.connectedWith.set(wallet.info);
    return address;
  }

  // [signMessage]: firma personal (EIP-191) del mensaje SIWE
  signMessage(message: string): Promise<`0x${string}`> {
    const { client, account } = this.ready();
    return client.signMessage({ account, message });
  }

  // [sendTransaction]: transferencia en Sepolia que el usuario confirma en su billetera | devuelve el hash
  sendTransaction(to: `0x${string}`, value: bigint): Promise<`0x${string}`> {
    const { client, account } = this.ready();
    return client.sendTransaction({ account, chain: APP_CHAIN, to, value });
  }

  private ready(): { client: WalletClient; account: `0x${string}` } {
    const account = this.account();
    if (!this.client || !account) throw new Error('Conecta tu billetera primero');
    return { client: this.client, account };
  }
}
