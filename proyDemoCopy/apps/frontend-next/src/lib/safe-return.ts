// [safeReturnPath · 2026-10-31]: destino de `?from=` tras iniciar sesión → solo rutas internas | [Seguridad]: evita la redirección abierta (`//sitio.com`, `/\sitio.com`, URL absolutas) | [Paradigma]: Función pura
export const safeReturnPath = (from: string | null): string | null =>
  from && /^\/(?![/\\])/.test(from) && !from.startsWith("/login") ? from : null;
