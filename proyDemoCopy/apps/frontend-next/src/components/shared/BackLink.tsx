"use client"; // [2026-10-23 · 4.º pase]: Client Component → puede leer el «lugar de regreso» anotado por el listado (sessionStorage)
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { readReturn } from "./RememberReturn";
// [BackLink · 2026-10-23]: enlace «volver» ÚNICO del sitio — icono de flecha + texto, sin aspecto de botón (antes cada página usaba «← …» con estilos distintos: botón, texto, migas)
// [Patrón]: Atomic Design (átomo) + Memento (con `memo` vuelve a la pestaña/filtros de origen) | [Principio]: DRY + consistencia visual | [Tecnología]: next/link (navegación cliente) + lucide-react (icono SVG)
// [A11y]: el icono es decorativo (`aria-hidden`); el texto dice a dónde se vuelve · foco visible con anillo
// [Progressive Enhancement]: el primer render (servidor) usa `href`; tras hidratar, si el listado anotó su URL (p. ej. /admin/users?tab=examenes&page=2) se usa esa

export function BackLink({ href, memo, children, className = "" }: { href: string; memo?: string; children: React.ReactNode; className?: string }) {
  const [target, setTarget] = useState(href);
  // `useEffect` (React): sessionStorage solo existe en el navegador → se lee tras montar (sin desajuste de hidratación)
  useEffect(() => setTarget((memo && readReturn(memo)) || href), [href, memo]);
  return (
    <Link
      href={target}
      className={`inline-flex w-fit items-center gap-2 rounded text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
