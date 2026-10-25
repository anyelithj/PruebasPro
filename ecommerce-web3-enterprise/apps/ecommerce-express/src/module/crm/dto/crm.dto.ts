// crm.dto.ts => contratos de salida del módulo CRM (CreateCustomerDto, UpdateCustomerDto, ScoringDto, ficha 360°).
import type { Segment } from "../model/crm.model";

// CustomerStats => agregados calculados en PostgreSQL (una fila por cliente)
export interface CustomerStats {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: Date;
  orders: number;
  ltvCents: number; // Valor de vida: suma de pedidos no cancelados
  lastOrderAt: Date | null;
  firstOrderAt: Date | null;
  segment: Segment;
}

// ScoringDto => puntaje 0..100 y de dónde sale (manual del equipo comercial o automático RFM)
export interface ScoringDto {
  value: number;
  source: "MANUAL" | "RFM";
}

// CustomerDto => fila del listado
export interface CustomerDto extends Omit<CustomerStats, "firstOrderAt"> {
  score: ScoringDto;
  tags: string[];
  archived: boolean;
}

export interface CustomerNoteDto {
  text: string;
  authorId: string;
  at: Date;
}

// Customer360Dto => ficha completa: historial, fidelidad, preferencias y predicción de próxima compra
export interface Customer360Dto extends CustomerDto {
  notes: CustomerNoteDto[];
  recentOrders: Array<{ id: string; orderNumber: string; status: string; totalCents: number; currency: string; placedAt: Date }>;
  favoriteCategories: Array<{ name: string; units: number }>;
  loyalty: { tier: string; pointsBalance: number } | null;
  reviews: number;
  avgOrderCents: number;
  nextPurchaseAt: Date | null; // Promedio de días entre pedidos sumado a la última compra (null => < 2 pedidos)
  suiteCrmId: string | null;
}

// AudienceMember => destinatario de una campaña de Marketing (solo clientes con opt-in de marketing)
export interface AudienceMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}
