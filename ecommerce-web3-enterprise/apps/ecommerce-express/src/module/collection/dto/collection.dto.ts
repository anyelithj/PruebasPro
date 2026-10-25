// collection.dto.ts => contratos de salida del módulo Collection.

// Tarjeta resumida de producto dentro de una colección
export interface CollectionProductDto {
  id: string;
  name: string;
  slug: string;
  minPriceCents: number;
  imageUrl: string | null;
  position: number;
}

export interface CollectionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  lookDiscountPercent: number | null; // RF-05.5 descuento por look completo
  isActive: boolean;
  productCount: number;
}

// CollectionDetailDto => "colección con todos sus productos por ID"
export interface CollectionDetailDto extends CollectionDto {
  products: CollectionProductDto[];
}
