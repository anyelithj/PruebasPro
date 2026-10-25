// invoice.route.ts => consulta/descarga: dueño o admin (lo valida el service); emisión y notas crédito: RBAC.
import { Router } from "express";
import { invoiceController } from "../controller/invoice.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const invoiceRouter = Router();
invoiceRouter.use(jwtAuthGuard);

invoiceRouter.post("/", requirePermission("CREATE", "invoice"), invoiceController.createInvoice);
invoiceRouter.get("/", invoiceController.listInvoices);
// RF-11.3 rutas literales ANTES de "/:id": resoluciones DIAN y reporte tributario (solo staff con permiso de facturación)
invoiceRouter.get("/report", requirePermission("CREATE", "invoice"), invoiceController.taxReport);
invoiceRouter.get("/resolution", requirePermission("CREATE", "invoice"), invoiceController.listResolutions);
invoiceRouter.post("/resolution", requirePermission("CREATE", "invoice"), invoiceController.createResolution);
invoiceRouter.patch("/resolution/:id", requirePermission("CREATE", "invoice"), invoiceController.updateResolution);
invoiceRouter.get("/:id", invoiceController.getInvoiceById);
invoiceRouter.get("/:id/pdf", invoiceController.downloadPdf);
invoiceRouter.post("/:id/credit-note", requirePermission("CREATE", "invoice"), invoiceController.createCreditNote);
invoiceRouter.post("/:id/email", invoiceController.sendByEmail); // RF-11.2 dueño o admin (lo valida el service)
invoiceRouter.post("/:id/void", requirePermission("CREATE", "invoice"), invoiceController.voidInvoice); // RF-11.3
