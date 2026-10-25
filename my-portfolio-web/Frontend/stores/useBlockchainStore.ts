// [FLUX][SRP] estado del agente blockchain — cadena activa, transporte, wallet, historial.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Chain } from '~/composables/useBlockchain';

export type Transport = 'sse' | 'ws';

export interface Interaction {
  id: number;
  chain: Chain;
  message: string;
  response: string;
  toolUsed: string;
  timestamp: string;
}

export const useBlockchainStore = defineStore('blockchain', () => {
  const activeChain = ref<Chain>('solana');
  // SSE por defecto (unidireccional, simple); WS para bidireccional.
  const transport = ref<Transport>('sse');
  const wallet = ref<string>('');
  const interactions = ref<Interaction[]>([]);

  const isSolana = computed(() => activeChain.value === 'solana');
  const chainHistory = computed(() =>
    interactions.value.filter((i) => i.chain === activeChain.value),
  );

  function setChain(chain: Chain): void {
    activeChain.value = chain;
    // La wallet no es intercambiable entre cadenas: se limpia al cambiar.
    wallet.value = '';
  }

  function setTransport(t: Transport): void {
    transport.value = t;
  }

  function setWallet(value: string): void {
    wallet.value = value;
  }

  function addInteraction(entry: Omit<Interaction, 'id' | 'timestamp'>): void {
    interactions.value = [
      { ...entry, id: Date.now() + Math.random(), timestamp: new Date().toISOString() },
      ...interactions.value,
    ].slice(0, 20);
  }

  return {
    activeChain,
    transport,
    wallet,
    interactions,
    isSolana,
    chainHistory,
    setChain,
    setTransport,
    setWallet,
    addInteraction,
  };
});
