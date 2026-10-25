"use client";
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage"; // [Reutilización]: store externo ya sincronizado entre componentes y pestañas | [Principio]: DRY
// [Hook useCart]: carrito de cursos del topbar (como NeuroLearning) | [Patrón]: Custom Hook + Repository (en localStorage) | [Principio]: SRP | [Paradigma]: Funcional (actualizaciones inmutables)
// ponytail: el carrito vive en el navegador (lo lee también Angular); el pago se hace en /checkout (Stripe) y el backend da el acceso por webhook

// `export interface` (TS): datos mínimos para listar y totalizar
export interface CartItem {
  id: string; // Id del curso (evita duplicados)
  title: string;
  price: number;
  currency: string; // ISO 4217 (USD…)
  color: string; // Color del idioma (punto de la fila)
  href: string; // Enlace al detalle
}

const EMPTY: CartItem[] = []; // Referencia estable (el hook compara por referencia)

export function useCart() {
  const [items, setItems] = useLocalStorage<CartItem[]>("cart", EMPTY);

  // `useCallback` (React): funciones estables para los consumidores | `some`/`filter` (ES5): sin mutar el array
  const add = useCallback((item: CartItem) => setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item])), [setItems]);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), [setItems]);
  const removeMany = useCallback((ids: string[]) => setItems((prev) => prev.filter((i) => !ids.includes(i.id))), [setItems]); // Tras comprar
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  // `reduce` (ES5): total en la moneda del primer ítem (el catálogo usa una sola moneda)
  const total = items.reduce((sum, i) => sum + i.price, 0);
  return { items, add, remove, removeMany, has, total, currency: items[0]?.currency ?? "USD" };
}
