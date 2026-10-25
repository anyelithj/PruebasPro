// [OBSERVER][FP] streaming SSE del agente blockchain vía EventSource → BFF Nitro.
// API idéntica a useBlockchainWs (LSP): { ...estado, start, stop }.
import { onScopeDispose } from 'vue';
import { blockchainEventSchema } from '~/shared/schemas/blockchain-solana.schema';
import { useAgentEvents } from '~/composables/useAgentEvents';

export type Chain = 'solana' | 'ethereum';

export function useBlockchain(chain: Chain) {
  const state = useAgentEvents();
  let source: EventSource | null = null;

  function stop(): void {
    source?.close();
    source = null;
    state.finish();
  }

  function start(message: string, wallet?: string): void {
    stop();
    state.begin();

    const params = new URLSearchParams({ message });
    if (wallet) params.set('wallet', wallet);
    // EventSource solo GET — el BFF Nitro pipea el SSE del backend.
    source = new EventSource(`/api/blockchain/${chain}/stream?${params.toString()}`);

    source.onmessage = (e: MessageEvent<string>): void => {
      if (e.data === '[DONE]') {
        stop();
        return;
      }
      try {
        const parsed = blockchainEventSchema.safeParse(JSON.parse(e.data));
        if (parsed.success) state.apply(parsed.data);
      } catch {
        // frame parcial/no-JSON: se ignora
      }
    };

    source.onerror = (): void => {
      // EventSource reintenta solo; si ya terminamos, no marcamos error.
      if (state.status.value === 'streaming') state.fail('Conexión interrumpida');
      stop();
    };
  }

  // Limpieza al desmontar el componente que usa el composable.
  onScopeDispose(stop);

  return {
    chain,
    events: state.events,
    streamingText: state.streamingText,
    toolCalls: state.toolCalls,
    toolResults: state.toolResults,
    status: state.status,
    error: state.error,
    isStreaming: state.isStreaming,
    reset: state.reset,
    start,
    stop,
  };
}
