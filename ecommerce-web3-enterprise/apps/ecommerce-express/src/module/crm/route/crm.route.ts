// crm.route.ts => CRM (montado en /api/v1/crm): datos personales de clientes, solo administradores.
import { Router } from "express";
import { crmController } from "../controller/crm.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";

export const crmRouter = Router();
crmRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

crmRouter.get("/churn", crmController.churn); // RF-18.8
crmRouter.get("/segment", crmController.segments); // RF-22.2 segmentos personalizados
crmRouter.post("/segment", crmController.createSegment);
crmRouter.post("/segment/preview", crmController.previewSegment);
crmRouter.patch("/segment/:id", crmController.updateSegment);
crmRouter.delete("/segment/:id", crmController.deleteSegment);
crmRouter.get("/high-value", crmController.highValue); // RF-22.6
crmRouter.get("/cohort", crmController.cohorts); // RF-22.7 / RF-24.2
crmRouter.get("/duplicate", crmController.duplicates); // RF-22.4
crmRouter.post("/merge", crmController.merge);
crmRouter.post("/import", crmController.importCsv);
crmRouter.get("/customer/:id/insights", crmController.insights); // RF-22.8 / 22.10
crmRouter.post("/reactivate", crmController.reactivate); // RF-18.8 / RF-20.8
crmRouter.post("/customer", crmController.createCustomer);
crmRouter.get("/customer", crmController.listCustomers);
crmRouter.get("/customer/:id", crmController.getCustomerById);
crmRouter.patch("/customer/:id", crmController.updateCustomer);
crmRouter.delete("/customer/:id", crmController.deleteCustomerById);
