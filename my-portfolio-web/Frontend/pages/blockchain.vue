<!--
  [Capa: Pages — ruta pública "/blockchain".]
  [Atomic Design: Template — compone el organism BlockchainSection.]
  [Sin auth: playground público para demostrar el agente LangGraph (Solana Devnet / Ethereum Sepolia).]
  [SEO: useSeoMeta propio. a11y: h1 + landmark main.]
-->
<script setup lang="ts">
import { useSeoMeta, definePageMeta } from '#imports'
import BlockchainSection from '~/components/organisms/BlockchainSection.vue'
import BlockchainBadge from '~/components/atoms/BlockchainBadge.vue'
import { useBlockchainStore } from '~/stores/useBlockchainStore'
import type { Chain } from '~/composables/useBlockchain'

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Agente Blockchain IA',
  description:
    'Agente de IA open source (LangGraph + Qwen2.5 vía Ollama) que interactúa con Solana Devnet y Ethereum Sepolia en tiempo real vía SSE/WebSocket.',
  ogTitle: 'Agente Blockchain IA — Solana & Ethereum',
  ogDescription: 'Consulta balances, gas, bloques y más con un agente IA self-hosted.',
  ogType: 'website',
})

const store = useBlockchainStore()
const chains: readonly Chain[] = ['solana', 'ethereum']
</script>

<template>
  <main id="main-content" class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-8 text-center">
      <h1 class="text-3xl font-black text-gray-900 dark:text-white">Agente Blockchain IA</h1>
      <p class="mx-auto mt-3 max-w-2xl text-gray-600 dark:text-gray-300">
        100% open source y self-hosted (LangGraph + Qwen2.5 + Ollama). Redes de prueba —
        sin fondos reales. Elige una cadena y conversa con el agente.
      </p>
    </header>

    <!-- Selector de cadena (a11y: radiogroup) -->
    <div
      role="radiogroup"
      aria-label="Cadena blockchain"
      class="mx-auto mb-6 inline-flex w-full max-w-xs items-center justify-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
    >
      <button
        v-for="c in chains"
        :key="c"
        type="button"
        role="radio"
        :aria-checked="store.activeChain === c"
        class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        :class="
          store.activeChain === c
            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-300'
            : 'text-gray-500 dark:text-gray-400'
        "
        @click="store.setChain(c)"
      >
        <BlockchainBadge :chain="c" />
        {{ c }}
      </button>
    </div>

    <!-- El organism se remonta al cambiar de cadena (key) → estado limpio por cadena. -->
    <BlockchainSection :key="store.activeChain" :chain="store.activeChain" />
  </main>
</template>
