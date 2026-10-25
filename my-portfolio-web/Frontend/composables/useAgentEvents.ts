// [DRY][FP] estado reactivo + reductor de eventos del agente blockchain.
// Compartido por useBlockchain (SSE) y useBlockchainWs (WS) para que ambos
// expongan EXACTAMENTE la misma API (LSP → intercambiables sin tocar la UI).
import { computed, ref } from 'vue';
import type { BlockchainEvent } from '~/shared/schemas/blockchain-solana.schema';

export type AgentStatus = 'idle' | 'streaming' | 'done' | 'error';
export interface ToolResult {
  tool: string;
  result: unknown;
}

export function useAgentEvents() {
  const events = ref<BlockchainEvent[]>([]);
  const streamingText = ref('');
  const toolCalls = ref<string[]>([]);
  const toolResults = ref<ToolResult[]>([]);
  const status = ref<AgentStatus>('idle');
  const error = ref<string | null>(null);

  const isStreaming = computed(() => status.value === 'streaming');

  function reset(): void {
    events.value = [];
    streamingText.value = '';
    toolCalls.value = [];
    toolResults.value = [];
    error.value = null;
    status.value = 'idle';
  }

  function begin(): void {
    reset();
    status.value = 'streaming';
  }

  // [Strategy via mapa] — reduce cada evento al estado, sin if-else encadenado largo.
  function apply(event: BlockchainEvent): void {
    events.value = [...events.value, event];
    switch (event.type) {
      case 'chunk':
        streamingText.value += event.content ?? '';
        break;
      case 'tool_call':
        if (event.tool) toolCalls.value = [...toolCalls.value, event.tool];
        break;
      case 'tool_result':
        toolResults.value = [
          ...toolResults.value,
          { tool: event.tool ?? '', result: event.result },
        ];
        break;
      case 'done':
        status.value = 'done';
        break;
      case 'error':
        error.value = event.content ?? 'Error del agente';
        status.value = 'error';
        break;
    }
  }

  function finish(): void {
    if (status.value === 'streaming') status.value = 'done';
  }

  function fail(message: string): void {
    error.value = message;
    status.value = 'error';
  }

  return {
    events,
    streamingText,
    toolCalls,
    toolResults,
    status,
    error,
    isStreaming,
    reset,
    begin,
    apply,
    finish,
    fail,
  };
}
