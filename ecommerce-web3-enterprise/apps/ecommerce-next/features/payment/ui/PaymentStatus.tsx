// PaymentStatus.tsx => estado de un pago como Badge con texto accesible (el color nunca es el único indicador: WCAG 1.4.1).
import { useTranslations } from "next-intl";
import { Badge } from "@/shared/ui/Badge";
import type { PaymentRecord } from "../api/payment.api";

// Tono por estado; el texto sale de messages/*.json -> payment.status.<ESTADO>
const TONE: Record<PaymentRecord["status"], "success" | "warning" | "danger" | "neutral" | "info"> = {
  PENDING: "warning",
  REQUIRES_ACTION: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "info",
  PARTIALLY_REFUNDED: "info",
};

export function PaymentStatus({ status }: { status: PaymentRecord["status"] }) {
  const t = useTranslations("payment.status");
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
