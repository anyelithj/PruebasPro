// [PhoneLink · 2026-10-24]: muestra el teléfono del usuario como enlace `tel:` (un toque llama desde el móvil) o «—» si no hay | [Patrón]: Presentational (atom) | [Principio]: SRP + DRY (lo usan la ficha de Gestión y el perfil) | [Paradigma]: Funcional + Declarativo
// Sin "use client": no tiene estado ni eventos → Server Component (cero JS en el navegador)

// `interface` (TS): contrato de props · `?:` + `| null`: el backend devuelve null cuando no hay teléfono
interface PhoneLinkProps {
  phone?: string | null;
  className?: string;
}

// [toTelHref]: "+57 300 123-4567" → "tel:+573001234567" | `replace` con regex global `/[^\d+]/g` (ES3) quita todo lo que no sea dígito o «+» (RFC 3966 no admite espacios)
const toTelHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function PhoneLink({ phone, className }: PhoneLinkProps) {
  // `?.trim()` (ES2020): tolera undefined/null · cadena vacía = sin teléfono
  const value = phone?.trim();
  // [Guard clause]: sin teléfono → guion largo (mismo «vacío» que el resto de la ficha)
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    // <a href="tel:"> (HTML): enlace semántico de llamada · `font-mono` alinea los dígitos
    <a href={toTelHref(value)} className={className ?? "font-mono text-xs text-primary hover:underline"}>
      {value}
    </a>
  );
}
