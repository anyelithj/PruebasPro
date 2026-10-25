// GuestCheckoutForm.tsx (Client Component · React + TanStack Query + Formik/Zod + Tailwind) => RF-08.1 "comprar como
// invitado": correo y nombre, sin contraseña. Crea una cuenta de invitado, abre sesión con el MISMO cierre del login
// (useCompleteLogin: vuelve al callbackUrl, normalmente el checkout o la tienda). Si el correo ya tiene cuenta, el
// backend envía un enlace mágico y aquí se explica (no se entrega una sesión ajena). Plegado en <details> nativo.
// Patrones: Template Method compartido (useCompleteLogin), Facade (guestCheckoutRequest). Paradigma declarativo.
"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { guestCheckoutRequest } from "../api/auth.api";
import { useCompleteLogin } from "./LoginForm";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { useZodForm } from "@/shared/hook/useZodForm";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { ApiError } from "@/shared/lib/api-client";

// Esquema del formulario: mensajes = claves de traducción (mismas del registro)
const guestSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "validation.emailRequired").email("validation.emailInvalid"),
  firstName: z.string().trim().min(1, "validation.firstNameRequired").max(80),
  lastName: z.string().trim().min(1, "validation.lastNameRequired").max(80),
});

export default function GuestCheckoutForm() {
  const t = useTranslations("auth.guest");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const completeLogin = useCompleteLogin();
  const guest = useMutation({ mutationFn: async (values: z.infer<typeof guestSchema>) => completeLogin(await guestCheckoutRequest(values, locale)) });
  const form = useZodForm({ schema: guestSchema, initialValues: { email: "", firstName: "", lastName: "" }, onSubmit: (values) => guest.mutate(values) });
  const exists = guest.error instanceof ApiError && guest.error.code === "ACCOUNT_EXISTS";

  return (
    <details className="w-full max-w-sm rounded-md border border-input px-4 py-3 text-sm open:pb-4">
      <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">{t("toggle")}</summary>
      <form onSubmit={form.handleSubmit} noValidate className="mt-3 flex flex-col gap-3">
        <p className="text-muted-foreground">{t("intro")}</p>
        <Input label={t("email")} type="email" autoComplete="email" error={form.error("email")} {...form.getFieldProps("email")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("firstName")} autoComplete="given-name" error={form.error("firstName")} {...form.getFieldProps("firstName")} />
          <Input label={t("lastName")} autoComplete="family-name" error={form.error("lastName")} {...form.getFieldProps("lastName")} />
        </div>
        {/* role="status" para el aviso esperado (cuenta existente: enlace enviado); role="alert" para errores */}
        {exists ? <p role="status" className="text-muted-foreground">{t("exists")}</p> : guest.isError && <p role="alert" className="text-red-600">{errorMessage(guest.error)}</p>}
        <Button type="submit" variant="secondary" loading={guest.isPending} fullWidth>{t("submit")}</Button>
      </form>
    </details>
  );
}
