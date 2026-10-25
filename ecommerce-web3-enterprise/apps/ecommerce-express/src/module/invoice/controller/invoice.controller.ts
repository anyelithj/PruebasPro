// invoice.controller.ts => capa HTTP del módulo Invoice.
import type { Request, Response } from "express";
import { invoiceService } from "../service/invoice.service";
import { CreateCreditNoteSchema, CreateInvoiceSchema, ListInvoicesQuerySchema, ResolutionSchema, TaxReportQuerySchema, UpdateResolutionSchema, VoidInvoiceSchema } from "../schema/invoice.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class InvoiceController {
  // createInvoice => POST /api/v1/invoice (admin: emisión manual/reintento con datos fiscales)
  public readonly createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { orderId, buyer } = CreateInvoiceSchema.parse(req.body);
    sendSuccess(res, await invoiceService.createInvoice(orderId, buyer), HttpStatus.CREATED);
  });

  public readonly listInvoices = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await invoiceService.listInvoices(ListInvoicesQuerySchema.parse(req.query), currentUser(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.getInvoiceById(parseId(req), currentUser(req)));
  });

  // downloadPdf => GET /api/v1/invoice/:id/pdf
  public readonly downloadPdf = asyncHandler(async (req: Request, res: Response) => {
    const { number, pdf } = await invoiceService.renderPdf(parseId(req), currentUser(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="factura-${number}.pdf"`);
    res.send(pdf);
  });

  // sendByEmail => POST /api/v1/invoice/:id/email (RF-11.2 reenviar al comprador: dueño o admin)
  public readonly sendByEmail = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.sendByEmail(parseId(req), currentUser(req)));
  });

  // voidInvoice => POST /api/v1/invoice/:id/void (RF-11.3)
  public readonly voidInvoice = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.voidInvoice(parseId(req), VoidInvoiceSchema.parse(req.body).reason));
  });

  // Resoluciones DIAN (RF-11.3)
  public readonly listResolutions = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.listResolutions());
  });
  public readonly createResolution = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.createResolution(ResolutionSchema.parse(req.body)), HttpStatus.CREATED);
  });
  public readonly updateResolution = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.updateResolution(parseId(req), UpdateResolutionSchema.parse(req.body).isActive));
  });

  // taxReport => GET /api/v1/invoice/report?from=&to=&format= (RF-11.3)
  public readonly taxReport = asyncHandler(async (req: Request, res: Response) => {
    const { from, to, format } = TaxReportQuerySchema.parse(req.query);
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="reporte-tributario-${from.toISOString().slice(0, 10)}.csv"`);
      res.send(await invoiceService.taxReportCsv(from, to));
      return;
    }
    sendSuccess(res, await invoiceService.taxReport(from, to));
  });

  // createCreditNote => POST /api/v1/invoice/:id/credit-note
  public readonly createCreditNote = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await invoiceService.createCreditNote(parseId(req), CreateCreditNoteSchema.parse(req.body)), HttpStatus.CREATED);
  });
}

export const invoiceController = new InvoiceController();
