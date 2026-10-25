// [OBSERVER][FP] streaming WebSocket bidireccional del agente blockchain → FastAPI.
// Misma API que useBlockchain (SSE) — intercambiables (LSP) sin tocar la UI.
import { onScopeDispose } from 'vue';
import { useRuntimeConfig } from '#app';
import { blockchainEventSchema } from '~/shared/schemas/blockchain-solana.schema';
import { useAgentEvents } from '~/composables/useAgentEvents';
import type { Chain } from '~/composables/useBlockchain';

function wsBase(httpBase: string): string {
  // http(s)://host/api/v1 → ws(s)://host  (las WS viven en la raíz de FastAPI).
  return httpBase.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '');
}

export function useBlockchainWs(chain: Chain) {
  const config = useRuntimeConfig();
  const state = useAgentEvents();
  let socket: WebSocket | null = null;

  function stop(): void {
    socket?.close();
    socket = null;
    state.finish();
  }

  function start(message: string, wallet?: string): void {
    stop();
    state.begin();

    const base = wsBase(config.public.fastapiBaseUrl as string);
    socket = new WebSocket(`${base}/ws/blockchain/${chain}`);

    socket.onopen = (): void => {
      socket?.send(JSON.stringify({ message, wallet_address: wallet }));
    };

    socket.onmessage = (e: MessageEvent<string>): void => {
      try {
        const parsed = blockchainEventSchema.safeParse(JSON.parse(e.data));
        if (parsed.success) {
          state.apply(parsed.data);
          if (parsed.data.type === 'done') stop();
        }
      } catch {
        // frame no-JSON: se ignora
      }
    };

    socket.onerror = (): void => {
      if (state.status.value === 'streaming') state.fail('WebSocket interrumpido');
    };
  }

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
