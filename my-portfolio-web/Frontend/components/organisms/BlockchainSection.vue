<!--
  [Atomic Design: Organism — UI completa del agente blockchain.]
  [FACADE: oculta la complejidad del agente LangGraph tras una UI simple.]
  [SOLID/DIP: depende de useBlockchain/useBlockchainWs (abstracción), no del fetch directo.]
  [LSP: SSE y WS exponen la misma API → el toggle de transporte no cambia el render.]
  [a11y: labels, aria-live en la salida, foco por teclado. UX: quick actions + estados claros.]
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useColorMode } from '#imports';
import { useFraudCheck } from '~/composables/useFraudCheck';
import AppButton from '~/components/atoms/AppButton.vue';
import AppIcon from '~/components/atoms/AppIcon.vue';
import BlockchainBadge from '~/components/atoms/BlockchainBadge.vue';
import TxStatusBadge from '~/components/atoms/TxStatusBadge.vue';
import BlockchainToolResult from '~/components/molecules/BlockchainToolResult.vue';
import WalletInput from '~/components/molecules/WalletInput.vue';
import { useBlockchain } from '~/composables/useBlockchain';
import { useBlockchainWs } from '~/composables/useBlockchainWs';
import { useBlockchainStore } from '~/stores/useBlockchainStore';
import type { Chain } from '~/composables/useBlockchain';

const props = defineProps<{ chain: Chain }>();

const store = useBlockchainStore();
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');

// Dos transportes con la MISMA API (LSP) — se elige uno en runtime.
const sse = useBlockchain(props.chain);
const ws = useBlockchainWs(props.chain);
const agent = computed(() => (store.transport === 'ws' ? ws : sse));

const message = ref('');
const walletValid = ref(true);

// [ML][SEGURIDAD WEB3] análisis de fraude de la wallet antes de usar el agente.
const fraud = useFraudCheck();
watch(
  [() => store.wallet, walletValid],
  ([wallet, valid]) => {
    if (wallet && valid) fraud.analyze(wallet, props.chain);
    else fraud.reset();
  },
);
// Bloquea el agente si la wallet es sospechosa (bot/spam/artificial).
const blockedByFraud = computed(() => fraud.result.value?.allowed === false);

const transports = ['sse', 'ws'] as const;

// [Strategy via mapa] — acciones rápidas (prompts) por cadena.
const QUICK_ACTIONS: Record<Chain, string[]> = {
  solana: [
    '¿Cuál es el balance de mi wallet?',
    'Solicita un airdrop de 1 SOL de prueba',
    'Muéstrame mis últimas transacciones',
    'Acuña mi badge de visitante (cNFT)',
    'Envíame 0.1 SOL a mi wallet',
  ],
  ethereum: [
    '¿Cuál es el balance de mi dirección?',
    'Estima el gas de una transferencia',
    'Dame la info del último bloque',
    'Valida mi dirección Ethereum',
    'Envíame 0.01 sETH a mi dirección',
  ],
};

const canSend = computed(
  () =>
    !agent.value.isStreaming.value &&
    message.value.trim().length > 0 &&
    walletValid.value &&
    !blockedByFraud.value,
);

function send(): void {
  if (!canSend.value) return;
  agent.value.start(message.value.trim(), store.wallet || undefined);
}

function runQuick(prompt: string): void {
  message.value = prompt;
  send();
}

function setTransport(t: 'sse' | 'ws'): void {
  store.setTransport(t);
}

// Detecta si el resultado de una tool incluye una transacción on-chain.
function hasTx(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  return Boolean(r.tx_signature ?? r.tx_hash);
}
</script>

<template>
  <section
    :class="{ dark: isDark }"
    class="w-full"
    aria-labelledby="agent-heading"
  >
    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <!-- Cabecera: cadena + transporte -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-4">
        <h2 id="agent-heading" class="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-white">
          <AppIcon :icon="['fas', 'robot']" :aria-hidden="true" />
          Agente
          <BlockchainBadge :chain="chain" />
        </h2>

        <!-- Toggle de transporte SSE / WebSocket (a11y: radiogroup) -->
        <div
          role="radiogroup"
          aria-label="Transporte de streaming"
          class="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 text-sm"
        >
          <button
            v-for="t in transports"
            :key="t"
            type="button"
            role="radio"
            :aria-checked="store.transport === t"
            :class="[
              'rounded-md px-3 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              store.transport === t
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
            ]"
            @click="setTransport(t)"
          >
            {{ t === 'sse' ? 'SSE' : 'WebSocket' }}
          </button>
        </div>
      </header>

      <div class="space-y-4 p-4">
        <!-- Wallet -->
        <WalletInput
          :chain="chain"
          :model-value="store.wallet"
          @update:model-value="store.setWallet($event)"
          @valid="walletValid = $event"
        />

        <!-- [ML] Análisis de fraude de la wallet (IsolationForest en FastAPI). -->
        <div
          v-if="fraud.result.value"
          class="flex items-start gap-2 rounded-lg border p-3 text-sm"
          :class="{
            'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300':
              fraud.result.value.risk_level === 'low',
            'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300':
              fraud.result.value.risk_level === 'medium',
            'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300':
              fraud.result.value.risk_level === 'high',
          }"
          role="status"
        >
          <AppIcon
            :icon="['fas', fraud.result.value.allowed ? 'shield-halved' : 'ban']"
            :aria-hidden="true"
            class="mt-0.5"
          />
          <div>
            <p class="font-semibold">
              Seguridad de wallet:
              {{ fraud.result.value.risk_level === 'low' ? 'Confiable' : fraud.result.value.risk_level === 'medium' ? 'Revisión' : 'Bloqueada' }}
              · riesgo {{ fraud.result.value.risk_percent }}%
            </p>
            <ul v-if="fraud.result.value.reasons.length" class="mt-1 list-disc pl-4 text-xs opacity-90">
              <li v-for="r in fraud.result.value.reasons" :key="r">{{ r }}</li>
            </ul>
            <p v-if="!fraud.result.value.allowed" class="mt-1 text-xs font-medium">
              El agente está deshabilitado para esta wallet.
            </p>
          </div>
        </div>

        <!-- Acciones rápidas -->
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Acciones rápidas
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="action in QUICK_ACTIONS[chain]"
              :key="action"
              type="button"
              :disabled="agent.isStreaming.value"
              class="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              @click="runQuick(action)"
            >
              {{ action }}
            </button>
          </div>
        </div>

        <!-- Entrada -->
        <form class="flex gap-2" @submit.prevent="send">
          <label for="agent-message" class="sr-only">Mensaje para el agente</label>
          <input
            id="agent-message"
            v-model="message"
            type="text"
            placeholder="Pregúntale al agente…"
            class="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
          <AppButton type="submit" variant="primary" :disabled="!canSend">
            <AppIcon :icon="['fas', 'paper-plane']" :aria-hidden="true" />
            Enviar
          </AppButton>
        </form>

        <!-- Salida del agente -->
        <div
          class="min-h-[6rem] rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4"
          aria-live="polite"
        >
          <!-- Herramientas invocadas -->
          <div v-if="agent.toolCalls.value.length" class="mb-3 flex flex-wrap gap-2">
            <span
              v-for="(tool, i) in agent.toolCalls.value"
              :key="`${tool}-${i}`"
              class="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300"
            >
              <AppIcon :icon="['fas', 'screwdriver-wrench']" :aria-hidden="true" />
              {{ tool }}
            </span>
          </div>

          <!-- Texto en streaming -->
          <p
            v-if="agent.streamingText.value"
            class="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100"
          >
            {{ agent.streamingText.value }}<span v-if="agent.isStreaming.value" class="chat-caret" aria-hidden="true">▋</span>
          </p>
          <p
            v-else-if="agent.isStreaming.value"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            Pensando…
          </p>
          <p
            v-else-if="!agent.toolResults.value.length && !agent.error.value"
            class="text-sm text-gray-400 dark:text-gray-500"
          >
            La respuesta del agente aparecerá aquí.
          </p>

          <!-- Resultados de herramientas -->
          <div v-if="agent.toolResults.value.length" class="mt-3 space-y-3">
            <div
              v-for="(res, i) in agent.toolResults.value"
              :key="`${res.tool}-${i}`"
              class="space-y-2"
            >
              <TxStatusBadge
                v-if="hasTx(res.result)"
                status="confirmed"
              />
              <BlockchainToolResult :item="res" />
            </div>
          </div>

          <!-- Error -->
          <p
            v-if="agent.error.value"
            role="alert"
            class="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <AppIcon :icon="['fas', 'triangle-exclamation']" :aria-hidden="true" />
            {{ agent.error.value }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat-caret {
  animation: caretBlink 1s step-end infinite;
}
@keyframes caretBlink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .chat-caret {
    animation: none !important;
  }
}
</style>
