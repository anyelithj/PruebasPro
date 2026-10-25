import type { Metadata } from "next";
import { Suspense } from "react"; // [Next.js 16]: useSearchParams (aviso ?magic=invalid) exige un límite de Suspense en páginas estáticas
import { LoginForm } from "@/components/auth/LoginForm";
import { BRAND } from "@/config/brand";
// [Página /login]: Server Component, monta LoginForm | [Patrón]: Container/Presentational | [Principio]: SRP | [Paradigma]: RSC + JSX

// [Metadata SEO]: específica por página | [Buena práctica]: SEO técnico
export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: `Accede a la cuenta ${BRAND.name} para continuar el aprendizaje.`,
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
