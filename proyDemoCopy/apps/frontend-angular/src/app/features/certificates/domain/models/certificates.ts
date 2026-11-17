import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
// [Modelo Certificates · Dominio]: certificado propio, cursos listos para certificar y vista pública de verificación (contrato de /api/certificates/* de NestJS) + reglas puras | [Patrón]: Schema-First (Zod) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional (funciones puras)
// [Privacidad]: la vista pública no trae email ni ids internos (el backend ya los omite; Zod descarta cualquier extra)

export const CERTIFICATE_STATUSES = ['issued', 'revoked'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CertificateSchema = z.object({
  id: z.string(),
  courseId: z.string().nullable(), // [2026-11-06]: null = certificado de NIVEL (examen sin curso)
  code: z.string(),
  recipientName: z.string(),
  courseTitle: z.string(),
  cefrLevel: z.string().nullish(), // A1–C2 → color del diploma · null = curso sin banda MCER (morado de marca)
  pdfSha256: z.string(),
  anchorTxHash: z.string().nullable(), // null = aún sin anclar en Sepolia (o anclaje no configurado)
  status: z.enum(CERTIFICATE_STATUSES),
  revokeReason: z.string().nullable(),
  issuedAt: z.string(),
  language: z.string().nullish(), // [2026-11-13]: idioma (filtro por píldoras) · null = no se pudo deducir
});
export type Certificate = z.infer<typeof CertificateSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

// [MyCertificates]: emitidos + cursos al 100 % que aún no tienen certificado (botón «Solicitar»)
export const MyCertificatesSchema = z.object({
  items: z.array(CertificateSchema),
  eligible: z.array(z.object({ courseId: z.string(), title: z.string(), examPassed: z.boolean().default(true) })), // [2026-11-06]: false → enlace al examen final
});
export type MyCertificates = z.infer<typeof MyCertificatesSchema>;

export const PublicCertificateSchema = z.object({
  valid: z.boolean(),
  status: z.enum(CERTIFICATE_STATUSES),
  code: z.string(),
  recipientName: z.string(),
  courseTitle: z.string(),
  cefrLevel: z.string().nullish(),
  issuedAt: z.string(),
  pdfSha256: z.string(),
  anchor: z
    .object({ txHash: z.string(), onchainValid: z.boolean(), confirmations: z.number().int() })
    .nullable(),
  revokeReason: z.string().nullable(),
});
export type PublicCertificate = z.infer<typeof PublicCertificateSchema>;

// [Formatos]: mismo código que imprime el PDF (AULA-XXXX-XXXX sin 0/O/1/I) y hash de transacción de 32 bytes
export const CERTIFICATE_CODE = /^AULA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

// [parseLookup]: lo que el usuario pega (código o hash) → consulta tipada | null = formato inválido (no se llama al backend) | [Principio]: Fail Fast
export type CertificateLookup = { kind: 'code'; value: string } | { kind: 'tx'; value: string };
export function parseLookup(raw: string): CertificateLookup | null {
  const v = raw.trim();
  if (TX_HASH.test(v)) return { kind: 'tx', value: v.toLowerCase() };
  const code = v.toUpperCase();
  return CERTIFICATE_CODE.test(code) ? { kind: 'code', value: code } : null;
}

// ───── [Caso E · 2026-11-13]: comprobar el PDF en el navegador (el archivo nunca sale del equipo) ─────
// [sha256Hex]: huella SHA-256 en hexadecimal | `crypto.subtle.digest` (Web Crypto API, contexto seguro) | Función pura respecto de los bytes
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  // `Uint8Array` + `padStart` (ES2017): cada byte → 2 dígitos hex
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
// [sameHash]: comparación sin mayúsculas ni prefijo 0x | Función pura
export const sameHash = (a: string, b: string): boolean => a.trim().toLowerCase().replace(/^0x/, '') === b.trim().toLowerCase().replace(/^0x/, '');
export type PdfCheck = 'idle' | 'checking' | 'match' | 'mismatch' | 'error';
