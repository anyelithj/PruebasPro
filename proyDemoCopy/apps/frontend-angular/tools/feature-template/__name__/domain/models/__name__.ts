import { z } from 'zod';
// [Plantilla · Modelo]: tipos + esquemas Zod de la funcionalidad __name__ (copiar la carpeta y reemplazar __name__ / __Name__) | [Patrón]: Schema-First | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional (sin Angular ni HTTP)

export const __Name__Schema = z.object({
  id: z.string(),
  title: z.string(),
});
export type __Name__ = z.infer<typeof __Name__Schema>;
