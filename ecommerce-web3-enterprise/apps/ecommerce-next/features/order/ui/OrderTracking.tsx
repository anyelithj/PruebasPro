// OrderTracking.tsx => timeline del envío (lista ordenada cronológica con marcadores) + guía y fecha estimada.
// RF-09.6 aviso de retraso; RF-09.1/10.5 mapa (OpenStreetMap embebido: sin librería ni llave, 0 KB de JS) con la
// ubicación del paquete o el destino; RF-09.3 contacto con la transportadora (teléfono y rastreo en su web).
"use client";

import type { GeoPoint, Shipment, ShipmentStatus } from "@/entities/order/model/order.types";
import { useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { useShipmentTracking } from "../api/order.api";

// osmEmbed => URL del mapa embebido de OpenStreetMap centrado en el punto (caja de ~0.1 grados + marcador)
const osmEmbed = (point: GeoPoint) => {
  const d = 0.05;
  const bbox = [point.longitude - d, point.latitude - d, point.longitude + d, point.latitude + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.latitude},${point.longitude}`;
};

// ShipmentMap => mapa + contacto (se carga aparte: el timeline no espera a la geocodificación)
function ShipmentMap({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("order.tracking");
  const { data } = useShipmentTracking(shipmentId);
  const point = data?.package ?? data?.destination;
  return (
    <div className="flex flex-col gap-3 print:hidden">
      {point && (
        <figure className="overflow-hidden rounded-lg border">
          {/* loading="lazy" => el iframe se descarga al acercarse al viewport (rendimiento) */}
          <iframe title={t("mapTitle")} src={osmEmbed(point)} loading="lazy" className="h-64 w-full" referrerPolicy="no-referrer" />
          <figcaption className="px-3 py-2 text-xs text-slate-600">{data?.package ? t("mapPackage", { place: point.label }) : t("mapDestination", { place: point.label })}</figcaption>
        </figure>
      )}
      {data?.carrier && (
        <p className="flex flex-wrap gap-3 text-sm">
          {data.carrier.phone && <a href={`tel:${data.carrier.phone}`} className="underline">{t("callCarrier", { carrier: data.carrier.name })}</a>}
          {data.carrier.trackingUrl && (
            <a href={data.carrier.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">{t("trackOnCarrier", { carrier: data.carrier.name })}</a>
          )}
        </p>
      )}
    </div>
  );
}

export function OrderTracking({ shipment }: { shipment: Shipment | null }) {
  const t = useTranslations("order.tracking");
  const { date, dateTime } = useFormat();
  if (!shipment) return <p className="text-sm text-slate-600">{t("pending")}</p>;
  return (
    <section aria-labelledby="tracking-title" className="flex flex-col gap-3">
      <h2 id="tracking-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm text-slate-700">
        {shipment.carrier ? `${shipment.carrier} · ${shipment.service ?? ""}` : t("noCarrier")}
        {shipment.trackingNumber && (
          <>
            {" "}
            · {t("trackingNumber")} <strong>{shipment.trackingNumber}</strong>
          </>
        )}
        {shipment.estimatedDelivery && shipment.status !== "DELIVERED" && <> · {t("eta", { date: date(shipment.estimatedDelivery) })}</>}
      </p>
      {shipment.delayed && <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("delayed")}</p>}
      <ShipmentMap shipmentId={shipment.id} />
      {/* <ol> => el orden de los eventos es significativo (cronológico) */}
      <ol className="relative flex flex-col gap-4 border-l-2 border-slate-200 pl-6">
        {shipment.events.map((event, index) => (
          <li key={`${event.status}-${index}`} className="relative">
            <span aria-hidden="true" className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white bg-slate-900" />
            <p className="text-sm font-medium text-slate-900">{t(`status.${event.status satisfies ShipmentStatus}`)}</p>
            <p className="text-sm text-slate-600">{event.description}</p>
            <p className="text-xs text-slate-500">
              <time dateTime={event.occurredAt}>{dateTime(event.occurredAt)}</time>
              {event.location && ` · ${event.location}`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
