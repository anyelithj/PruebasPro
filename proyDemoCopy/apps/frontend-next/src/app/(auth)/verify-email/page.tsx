import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export const metadata: Metadata = {
  title: "Verificar email",
  description: "Confirma tu dirección de correo electrónico.",
  alternates: { canonical: "/verify-email" },
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp?.token;
  const token = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <VerifyEmailForm token={token} />;
}
