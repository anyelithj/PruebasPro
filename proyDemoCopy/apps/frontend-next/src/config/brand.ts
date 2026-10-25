// [Branding como configuración]: la marca vive fuera del dominio y de la lógica de negocio para cambiarla sin tocar código | [Patrón]: Configuration Object + SSOT | [Principio]: OCP + SRP | [Paradigma]: Declarativo
// [Tecnología]: TypeScript + variables de entorno públicas de Next.js (NEXT_PUBLIC_* se inyectan en build para cliente y servidor)

// `export` (ES Modules): hace visible la interfaz a otros módulos | `interface` (TS): contrato estructural de tipos, se borra al compilar (coste cero en runtime)
export interface BrandConfig {
  // `readonly` (TS): impide reasignar la propiedad tras crear el objeto | [Principio]: Inmutabilidad
  readonly name: string; // Nombre completo mostrado en títulos, SEO y footer
  readonly prefix: string; // Parte del logotipo en color normal (ej. "Aula de")
  readonly highlight: string; // Parte del logotipo resaltada con el color primario (ej. "Idiomas")
  readonly tagline: string; // Lema corto para metadatos y hero
  readonly supportEmail: string; // Correo de contacto visible (se muestra como texto, no se envía nada)
}

// `const` (JS): enlace inmutable | `??` (ES2020, nullish coalescing): usa el valor por defecto solo si la env es null/undefined
const prefix = process.env.NEXT_PUBLIC_BRAND_PREFIX ?? "Aula de"; // Override por env sin recompilar la lógica
const highlight = process.env.NEXT_PUBLIC_BRAND_HIGHLIGHT ?? "Idiomas"; // Palabra destacada del logotipo

// `Object.freeze` (JS): congela el objeto en runtime (además del `readonly` en compilación) | [Patrón]: Immutable Value
export const BRAND: BrandConfig = Object.freeze({
  prefix, // Shorthand property (ES2015): equivale a `prefix: prefix`
  highlight, // Idem
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? `${prefix} ${highlight}`, // Template literal (ES2015) para derivar el nombre | [Principio]: DRY
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Aprende idiomas por niveles MCER (A1–C2)", // Lema por defecto
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "soporte@example.com", // example.com: dominio reservado (RFC 2606), evita usar un dominio real ajeno
});
