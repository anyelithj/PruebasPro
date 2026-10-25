// page.tsx (/dashboard/ai-assistant) => LLM Assistant: conocimiento RAG, herramientas y evaluaciones.
// Server Component mínimo: metadatos + encabezado (adminPage) y la sección interactiva del panel (RBAC: layout (admin)).
import { AiAssistantAdmin } from "@/features/admin-dashboard/ui/AiAssistantAdmin";
import { adminMetadata, adminPage } from "../AdminSection";

export const generateMetadata = adminMetadata("aiAssistant");
export default adminPage("aiAssistant", AiAssistantAdmin);
