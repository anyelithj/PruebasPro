// MagicLinkLogin.tsx (Client Component · React + TanStack Query) => destino del enlace mágico (RF-01.3): canjea el token
// UNA sola vez por la sesión del backend y la entrega a next-auth con el MISMO cierre del login normal (useCompleteLogin).
// El "useRef" evita el doble canje del modo estricto de React 18/19 en desarrollo (el efecto se monta dos veces y el
// segundo intento fallaría porque el token ya se consumió). Patrón: Template Method compartido (useCompleteLogin).
"use client";

import { useEffect, useRef } from "react"; // Hooks de React: efecto al montar y referencia mutable sin re-render
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { magicLinkLoginRequest } from "../api/auth.api";
import { useCompleteLogin } from "./LoginForm"; // signIn("credentials") + redirección por rol (DRY)
import { Link } from "@/shared/lib/i18n/navigation";
import { Spinner } from "@/shared/ui/Spinner";

export default function MagicLinkLogin({ token }: { token: string }) {
  const t = useTranslations("auth.magic");
  const completeLogin = useCompleteLogin();
  const started = useRef(false); // "useRef" => persiste entre renders sin provocar uno nuevo
  const login = useMutation({ mutationFn: async () => completeLogin(await magicLinkLoginRequest(token)) });
  const { mutate } = login; // Referencia estable de TanStack Query => dependencia segura del efecto

  useEffect(() => {
    if (started.current || !token) return; // Guard: un solo intento por carga de página
    started.current = true;
    mutate();
  }, [token, mutate]);

  if (login.isError || !token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p role="alert" className="text-sm text-red-600">{t("failed")}</p>
        <Link href="/login" className="text-sm font-medium text-foreground hover:underline">{t("retry")}</Link>
      </div>
    );
  }
  // aria-live="polite" => el estado de carga se anuncia sin interrumpir
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <Spinner className="size-4" /> {t("verifying")}
    </p>
  );
}
