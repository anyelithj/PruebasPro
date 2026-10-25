// [ISP] tipos de eventos de streaming WS/SSE — contrato mínimo compartido

export type ChatEventType = 'chunk' | 'source' | 'done' | 'error';

export interface ChatEvent {
  type: ChatEventType;
  content?: string;
  source?: string;
}

export const chatChunk = (content: string): ChatEvent => ({ type: 'chunk', content });
export const chatSource = (source: string): ChatEvent => ({ type: 'source', source });
export const chatDone = (): ChatEvent => ({ type: 'done' });
export const chatError = (content: string): ChatEvent => ({ type: 'error', content });
