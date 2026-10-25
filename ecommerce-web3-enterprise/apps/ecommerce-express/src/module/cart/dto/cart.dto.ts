// cart.dto.ts => contratos de salida del módulo Cart (lo que pinta CartDrawer/CartSummary en Next.js).

export interface CartItemDto {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number; // Precio ACTUAL de la variante (el checkout lo congela)
  quantity: number;
  lineTotalCents: number;
  available: number;
  priceChanged: boolean; // true => el precio cambió desde que se agregó (la UI avisa al cliente)
  previousUnitPriceCents: number | null; // RF-07.5 precio al agregarlo (solo si cambió): la UI muestra "bajó de X a Y"
  priceDropped: boolean; // RF-07.5 true => ahora está más barato que cuando se agregó
  lowStock: boolean; // RF-07.5 true => quedan pocas unidades (disponible <= LOW_STOCK_THRESHOLD)
  purchasable: boolean; // false => producto despublicado/agotado: no puede pasar al checkout
}

export interface CartDto {
  id: string;
  currency: string;
  items: CartItemDto[];
  itemCount: number; // Suma de cantidades (badge del ícono del carrito)
  subtotalCents: number;
  expiresAt: Date;
  // RF-07.3 puntos de fidelidad canjeables en esta compra (el checkout vuelve a validarlos al aplicarlos)
  loyalty: { balance: number; maxPoints: number; pointValueCents: number };
}
