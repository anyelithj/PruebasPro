// cms.controller.ts => capa HTTP del módulo CMS: valida params/query/body con Zod y delega en el service (SRP).
// "staff" (ADMIN o VENDOR con sesión) ve borradores; el público solo contenido publicado.
import type { Request, Response } from "express";
import { cmsService } from "../service/cms.service";
import { ContentSchema, KindParamSchema, LeadSchema, ListContentQuerySchema, ListLeadsQuerySchema, SectionParamSchema, SlugParamSchema, UpdateContentSchema } from "../schema/cms.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser, isStaff } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

// staff => hay sesión (optionalAuth) y el rol es de equipo
const staff = (req: Request) => Boolean(req.user && isStaff(req.user));

export class CmsController {
  // GET /api/v1/cms/:kind?status=&locale=&q=&upcoming=&page=
  public readonly listCmsContents = asyncHandler(async (req: Request, res: Response) => {
    const { kind } = KindParamSchema.parse(req.params);
    const { items, meta } = await cmsService.listContent(kind, ListContentQuerySchema.parse(req.query), staff(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/cms/:kind/:slug
  public readonly getCmsContentBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { kind, slug } = SlugParamSchema.parse(req.params);
    sendSuccess(res, await cmsService.getContentBySlug(kind, slug, staff(req)));
  });

  // POST /api/v1/cms/:kind
  public readonly createCmsContent = asyncHandler(async (req: Request, res: Response) => {
    const { kind } = KindParamSchema.parse(req.params);
    sendSuccess(res, await cmsService.createContent(kind, ContentSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  // PATCH /api/v1/cms/:kind/:id (ObjectId)
  public readonly updateCmsContent = asyncHandler(async (req: Request, res: Response) => {
    const { kind } = KindParamSchema.parse(req.params);
    sendSuccess(res, await cmsService.updateContent(kind, parseObjectId(req), UpdateContentSchema.parse(req.body)));
  });

  // DELETE /api/v1/cms/:kind/:id => archiva
  public readonly deleteCmsContentById = asyncHandler(async (req: Request, res: Response) => {
    const { kind } = KindParamSchema.parse(req.params);
    await cmsService.deleteContentById(kind, parseObjectId(req));
    sendNoContent(res);
  });

  // POST /api/v1/cms/landing/:slug/lead (público, con rate limit)
  public readonly createLandingLead = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = SlugParamSchema.parse({ kind: "landing", slug: req.params["slug"] });
    sendSuccess(res, await cmsService.createLead(slug, LeadSchema.parse(req.body)), HttpStatus.CREATED);
  });

  // GET /api/v1/cms/lead?landing=&page=
  public readonly listLandingLeads = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await cmsService.listLeads(ListLeadsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/cms/config => público (subconjunto seguro) o completo para staff
  public readonly getStoreConfig = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cmsService.getConfig(staff(req)));
  });

  // PUT /api/v1/cms/config/:section (payment | shipping | tax | currency)
  public readonly updateStoreConfig = asyncHandler(async (req: Request, res: Response) => {
    const { section } = SectionParamSchema.parse(req.params);
    sendSuccess(res, await cmsService.updateConfig(section, req.body, currentUser(req).id));
  });
}

export const cmsController = new CmsController();
