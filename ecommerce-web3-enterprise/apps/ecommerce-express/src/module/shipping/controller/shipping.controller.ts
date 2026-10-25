// shipping.controller.ts => capa HTTP del módulo Shipping.
import type { Request, Response } from "express";
import { shippingService } from "../service/shipping.service";
import { AddressSuggestQuerySchema, CarrierStatsQuerySchema, ListShippingQuerySchema, ShippingLabelSchema, ShippingRateSchema, UpdateShippingSchema } from "../schema/shipping.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class ShippingController {
  // createShippingRate => POST /api/v1/shipping/rate
  public readonly createShippingRate = asyncHandler(async (req: Request, res: Response) => {
    const input = ShippingRateSchema.parse(req.body);
    // "in" => type guard entre las dos variantes de la unión (dirección guardada vs destino explícito)
    const rates =
      "addressId" in input
        ? await shippingService.quoteForAddress(currentUser(req).id, input.addressId, input.weightGrams, input.subtotalCents)
        : await shippingService.quoteRates(input.destination, input.weightGrams, input.subtotalCents);
    sendSuccess(res, rates);
  });

  // addressSuggest => GET /api/v1/shipping/address-suggest?q= (RF-08.2)
  public readonly addressSuggest = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.suggestAddresses(AddressSuggestQuerySchema.parse(req.query).q));
  });

  // carrierStats => GET /api/v1/shipping/stats?days= (RF-10.7, staff)
  public readonly carrierStats = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.carrierStats(CarrierStatsQuerySchema.parse(req.query).days));
  });

  // tracking => GET /api/v1/shipping/:id/tracking (RF-09.1/10.5 mapa + RF-09.3 contacto con la transportadora)
  public readonly tracking = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.tracking(parseId(req), currentUser(req)));
  });

  // createShippingLabel => POST /api/v1/shipping/label
  public readonly createShippingLabel = asyncHandler(async (req: Request, res: Response) => {
    const { shipmentId } = ShippingLabelSchema.parse(req.body);
    sendSuccess(res, await shippingService.createShippingLabel(shipmentId), HttpStatus.CREATED);
  });

  // voidShippingLabel => DELETE /api/v1/shipping/:id/label (deshace "generar guía" mientras el paquete no salió)
  public readonly voidShippingLabel = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.voidShippingLabel(parseId(req)));
  });

  // downloadLabel => GET /api/v1/shipping/:id/label (PDF)
  public readonly downloadLabel = asyncHandler(async (req: Request, res: Response) => {
    const pdf = await shippingService.renderLabel(parseId(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="guia-${parseId(req)}.pdf"`);
    res.send(pdf);
  });

  public readonly listShippings = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await shippingService.listShippings(ListShippingQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getShippingById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.getShippingById(parseId(req), currentUser(req)));
  });

  public readonly updateShipping = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await shippingService.updateShipping(parseId(req), UpdateShippingSchema.parse(req.body)));
  });

  public readonly deleteShippingById = asyncHandler(async (req: Request, res: Response) => {
    await shippingService.deleteShippingById(parseId(req));
    sendNoContent(res);
  });
}

export const shippingController = new ShippingController();
