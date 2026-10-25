// [OBSERVER][SRP] estado global de toasts — publish/subscribe vía useState reactivo.
import { useState } from '#app';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);

  function push(message: string, type: ToastType = 'info', ttlMs = 4000): void {
    const id = Date.now() + Math.random();
    toasts.value = [...toasts.value, { id, type, message }];
    if (import.meta.client) {
      setTimeout(() => dismiss(id), ttlMs);
    }
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    info: (m: string) => push(m, 'info'),
    dismiss,
  };
}
