// cart.store.ts (Pinia, setup store) => carrito del usuario: vive en Express (por usuario, lo comparte el checkout);
// aquí solo se guarda la última copia que respondió el servidor + si el panel lateral está abierto.
// Cada acción devuelve el carrito COMPLETO actualizado: se reemplaza sin pedirlo otra vez (una petición por acción).
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { useAuth } from "~~/shared/composable/useAuth";
import type { Cart } from "~~/entities/cart/model/cart.types";

export const useCartStore = defineStore("cart", () => {
  const api = useApi();
  const { isAuthenticated } = useAuth();
  const cart = ref<Cart | null>(null);
  const isOpen = ref(false);
  const pending = ref(false);
  const count = computed(() => cart.value?.itemCount ?? 0);

  // run => ejecuta una acción del carrito y guarda la respuesta (los errores suben a la UI para el aviso)
  // RF-28.4 sin conexión el Service Worker encola la acción y responde { queued: true } sin carrito: se conserva la
  // última copia (no se vacía en pantalla) y el carrito real llega al sincronizar
  async function run(action: () => Promise<{ data: Cart; queued?: boolean }>): Promise<void> {
    pending.value = true;
    try {
      const result = await action();
      if (!result.queued) cart.value = result.data;
    } finally {
      pending.value = false;
    }
  }

  const load = () => (isAuthenticated.value ? run(() => api.get<Cart>("/cart/active")).catch(() => undefined) : Promise.resolve());
  const add = (variantId: string, quantity: number) => run(() => api.post<Cart>("/cart/item", { variantId, quantity }));
  const update = (itemId: string, quantity: number) => run(() => api.patch<Cart>(`/cart/item/${itemId}`, { quantity }));
  const remove = (itemId: string) => run(() => api.del<Cart>(`/cart/item/${itemId}`));

  return { cart, isOpen, pending, count, load, add, update, remove };
});
