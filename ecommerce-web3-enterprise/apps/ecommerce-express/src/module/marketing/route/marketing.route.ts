// marketing.route.ts => campañas (montado en /api/v1/marketing): jwtMiddleware + AdminGuard (envíos masivos reales).
import { Router } from "express";
import { marketingController } from "../controller/marketing.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";

export const marketingRouter = Router();
marketingRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

marketingRouter.post("/campaign", marketingController.createCampaign);
marketingRouter.get("/campaign", marketingController.listCampaigns);
marketingRouter.get("/campaign/:id", marketingController.getCampaignById);
marketingRouter.patch("/campaign/:id", marketingController.updateCampaign);
marketingRouter.delete("/campaign/:id", marketingController.deleteCampaignById);
