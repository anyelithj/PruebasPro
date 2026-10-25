import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { BRAND } from "@/config/brand";
// [Página /register]: Server Component, monta RegisterForm | [Patrón]: Container/Presentational | [Principio]: SRP | [Paradigma]: RSC + JSX

export const metadata: Metadata = {
  title: "Crear cuenta",
  description:
    `Regístrate gratis en ${BRAND.name} — evaluaciones inteligentes y feedback con IA.`,
  alternates: { canonical: "/register" },
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
