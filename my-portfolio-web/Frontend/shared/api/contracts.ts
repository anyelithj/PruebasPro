// [DDD][ISP] contratos que reflejan el ApiResponse<T> de los backends Nest/FastAPI.
// [DRY] única fuente de verdad del envelope estándar en el frontend.
import type { Role } from '../enums';

export type ApiProvider = 'nest' | 'fastapi';

// Envelope estándar que ambos backends devuelven: { success, data, message? }
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message?: string;
  error?: { code: string; message: string; details?: unknown };
}

export interface PageMeta {
  page: number;
  pageSize?: number; // Nest
  page_size?: number; // FastAPI (snake_case)
  total: number;
  totalPages?: number;
  total_pages?: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// Usuario tal como lo devuelven /auth y /users/me (ambos omiten el hash).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  is_active?: boolean;
  // Timestamps: Nest camelCase / FastAPI snake_case (opcionales).
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// Respuesta de auth. Nest usa camelCase, FastAPI snake_case → normalizamos en useApi.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  user: AuthUser;
}

// Estados del ciclo de vida de un envío de contacto — iguales en Nest y FastAPI.
export type ContactStatus = 'pending' | 'read' | 'replied' | 'archived';

export const CONTACT_STATUSES: readonly ContactStatus[] = [
  'pending',
  'read',
  'replied',
  'archived',
];

// Envío del formulario público (Nest camelCase / FastAPI snake_case).
export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactStatus;
  category?: string | null; // [ML] job | freelance | spam
  priority?: string | null; // [ML] high | medium | low
  ipAddress?: string | null;
  ip_address?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// Proyecto completo tal como lo devuelve el backend (Nest camelCase / FastAPI snake_case).
export interface AdminProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  link: string;
  techs: string[];
  featured: boolean;
  imageUrl?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// [ML] Resultado de detección de fraude en wallet (FastAPI /ml/fraud/wallet).
export interface FraudResult {
  address: string;
  chain?: string | null;
  valid_format: boolean;
  is_suspicious: boolean;
  allowed: boolean;
  risk_level: 'low' | 'medium' | 'high';
  risk_percent: number;
  anomaly_score: number;
  reasons: string[];
}

// [ML] Clasificación de mensaje de contacto (FastAPI /ml/contact/classify).
export interface ContactClassification {
  category: 'job' | 'freelance' | 'spam';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  scores: Record<string, number>;
}

// Post del blog (backend /posts). Mismo shape para lista pública, detalle y admin.
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  imageUrl?: string | null;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}
