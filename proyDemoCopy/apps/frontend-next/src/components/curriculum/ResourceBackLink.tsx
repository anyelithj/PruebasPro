import { BackLink } from "@/components/shared/BackLink";
import { backLabel, type CurriculumItemKind } from "@/types/curriculum";
// [ResourceBackLink · 2026-10-24]: «Volver a vocabulario / regla gramatical / pronunciación…» según el TIPO del recurso abierto (antes siempre «Volver a recursos»)
// [Patrón]: Decorator/Wrapper sobre BackLink (reutiliza icono, estilo y memoria de filtros) | [Principio]: DRY + SSOT (texto de BACK_LABEL en types/curriculum) | [Paradigma]: Declarativo
// [Tecnología]: componente sin estado ni hooks → se usa desde Server Components (las páginas RSC) y solo BackLink se hidrata

export function ResourceBackLink({ kind, href, memo }: { kind?: CurriculumItemKind; href: string; memo?: string }) {
  return (
    <BackLink href={href} memo={memo}>
      {backLabel(kind)}
    </BackLink>
  );
}
