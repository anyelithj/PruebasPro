import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '../http/api-url.token';
// [CartService · core/cart]: el MISMO carrito del topbar de Next.js (localStorage «cart», mismo origen) + compra simulada | [Patrón]: Singleton + Repository (localStorage) + Observer (evento `storage`) + Command (checkout) | [Principio]: SRP + SSOT (Next.js y Angular leen la misma clave) | [Paradigma]: Reactivo (signals) + Funcional (actualizaciones inmutables)
// ponytail: compra sin pasarela (igual que checkoutAction de Next.js); el sprint 7.3 (Payments) la cambia por orden + webhook

const CART_KEY = 'cart'; // Clave de useCart (apps/frontend-next/src/hooks/useCart.ts)

// [Esquema]: misma forma que CartItem de Next.js | [Seguridad]: localStorage es entrada no confiable → se valida con Zod
const CartItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  currency: z.string(),
  color: z.string(),
  href: z.string(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

// [read]: JSON inválido o almacenamiento bloqueado → carrito vacío | `safeParse` (Zod) nunca lanza
function read(): CartItem[] {
  try {
    const parsed = z.array(CartItemSchema).safeParse(JSON.parse(localStorage.getItem(CART_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly _items = signal<CartItem[]>(read());
  readonly items = this._items.asReadonly();
  // `computed` (Angular): total y moneda derivados (el catálogo usa una sola moneda, como en Next.js)
  readonly total = computed(() => this._items().reduce((sum, i) => sum + i.price, 0));
  readonly currency = computed(() => this._items()[0]?.currency ?? 'USD');

  constructor() {
    // [Sincronía]: un curso añadido en Next.js (otra pestaña) aparece aquí sin recargar | `storage` (DOM) llega desde OTRAS pestañas
    const onStorage = (e: StorageEvent) => e.key === CART_KEY && this._items.set(read());
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  remove(id: string): void {
    this.write(this._items().filter((i) => i.id !== id));
  }

  // [checkout]: compra cada curso por el BFF (/api/courses/:id/purchase) | `Promise.allSettled` (ES2020): uno que falle no cancela los demás → quita solo los comprados
  async checkout(): Promise<{ purchased: string[]; failed: string[] }> {
    const ids = this._items().map((i) => i.id);
    const results = await Promise.allSettled(ids.map((id) => firstValueFrom(this.http.post(`${this.api}/courses/${encodeURIComponent(id)}/purchase`, {}))));
    const purchased = ids.filter((_, i) => results[i]?.status === 'fulfilled');
    const failed = results.flatMap((r) => (r.status === 'rejected' ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : []));
    this.write(this._items().filter((i) => !purchased.includes(i.id)));
    return { purchased, failed };
  }

  // [write]: estado + localStorage | `try/catch`: sin almacenamiento el carrito dura lo que la pestaña
  private write(items: CartItem[]): void {
    this._items.set(items);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Modo privado o cuota llena
    }
  }
}
