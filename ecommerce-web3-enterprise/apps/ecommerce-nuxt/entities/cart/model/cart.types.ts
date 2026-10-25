// cart.types.ts (entities) => forma JSON del carrito (GET /api/v1/cart/active). El carrito vive en Express por
// usuario: el mismo carrito lo ve el checkout.

export interface CartLine {
  id: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  available: number;
  priceChanged: boolean;
  purchasable: boolean;
  previousUnitPriceCents: number | null; // RF-07.5 precio cuando se agregó (si cambió)
  priceDropped: boolean; // RF-07.5 ahora está más barato
  lowStock: boolean; // RF-07.5 quedan pocas unidades
}

export interface Cart {
  id: string;
  currency: string;
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  loyalty: { balance: number; maxPoints: number; pointValueCents: number }; // RF-07.3 canje disponible
}
