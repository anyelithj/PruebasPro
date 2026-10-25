// nuxt.types.ts => amplía los tipos de Nuxt (declaration merging de TypeScript) para el RBAC por página:
// definePageMeta({ middleware: ["auth", "rbac"], roles: ["ADMIN"] }) queda tipado y validado en compilación.
import type { RoleName } from "../lib/auth-config";

// "declare module" => agrega propiedades a una interfaz existente de otra librería sin modificarla (Open/Closed)
declare module "#app" {
  interface PageMeta {
    roles?: RoleName[]; // Roles permitidos; sin valor => basta con estar autenticado
  }
}

export {}; // Convierte el archivo en módulo (requisito de "declare module" con augmentation)
