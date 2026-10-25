// page.tsx (/dashboard) => Portada del panel según el rol: ADMIN => KPIs globales y widgets; VENDOR => sus ventas,
// catálogo y despachos (PanelOverview = Strategy por rol). Server Component mínimo (RBAC: middleware + layout (admin)).
import { PanelOverview } from "@/features/admin-dashboard/ui/VendorOverview";
import { adminMetadata, adminPage } from "./AdminSection";

export const generateMetadata = adminMetadata("overview");
export default adminPage("overview", PanelOverview);
