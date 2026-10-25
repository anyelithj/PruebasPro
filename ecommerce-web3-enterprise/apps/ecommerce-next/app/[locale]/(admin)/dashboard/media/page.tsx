// page.tsx (/dashboard/media) => Media Manager (Cloudinary): subir, ordenar por carpeta, texto alternativo y borrado en lote.
// Server Component mínimo: metadatos + encabezado (adminPage) y la sección interactiva del panel (RBAC: layout (admin)).
import { MediaGrid } from "@/features/media/ui/MediaGrid";
import { adminMetadata, adminPage } from "../AdminSection";

export const generateMetadata = adminMetadata("media");
export default adminPage("media", MediaGrid);
