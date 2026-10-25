import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
  description: "Define una nueva contraseña con el enlace de recuperación.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp?.token;
  const token = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <ResetPasswordForm token={token} />;
}
