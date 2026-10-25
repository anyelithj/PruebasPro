// MagicLinkForm.tsx (Client Component · React + TanStack Query + Formik/Zod + Tailwind) => RF-01.3 "entrar sin contraseña":
// pide un enlace de un solo uso al correo. Va plegado en un <details> nativo (0 KB de JS para abrir/cerrar, accesible por
// teclado) para no recargar el login. La respuesta es la misma exista o no la cuenta (el backend evita la enumeración).
// Patrones: Facade (magicLinkRequest oculta la API), Observer (useMutation notifica estados). Paradigma declarativo.
"use client"; // Directiva de Next.js: usa hooks => se ejecuta en el navegador

import { useMutation } from "@tanstack/react-query"; // Escritura con estados pending/success/error
import { useLocale, useTranslations } from "next-intl"; // Idioma activo y textos traducidos
import { z } from "zod"; // Esquema de validación (misma regla que el backend: email válido)
import { magicLinkRequest } from "../api/auth.api";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { useZodForm } from "@/shared/hook/useZodForm"; // Formik + Zod (stack del proyecto)
import { useErrorMessage } from "@/shared/hook/useErrorMessage";

// "z.object" => esquema del formulario; los mensajes son claves de traducción (mismas del login)
const magicLinkSchema = z.object({ email: z.string().trim().toLowerCase().min(1, "validation.emailRequired").email("validation.emailInvalid") });

export default function MagicLinkForm() {
  const t = useTranslations("auth.magic");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  // "mutationFn" => la petición; el correo llega en el idioma de la interfaz (locale)
  const request = useMutation({ mutationFn: (email: string) => magicLinkRequest(email, locale) });
  const form = useZodForm({ schema: magicLinkSchema, initialValues: { email: "" }, onSubmit: (values) => request.mutate(values.email) });

  return (
    <details className="w-full max-w-sm rounded-md border border-input px-4 py-3 text-sm open:pb-4">
      {/* <summary> => botón nativo del acordeón (Enter/Espacio lo abren) */}
      <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">{t("toggle")}</summary>
      {request.isSuccess ? (
        // role="status" => el lector de pantalla anuncia la confirmación sin mover el foco
        <p role="status" className="mt-3 text-muted-foreground">{t("sent")}</p>
      ) : (
        <form onSubmit={form.handleSubmit} noValidate className="mt-3 flex flex-col gap-3">
          <Input label={t("email")} type="email" autoComplete="email" error={form.error("email")} {...form.getFieldProps("email")} />
          {request.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(request.error)}</p>}
          <Button type="submit" variant="secondary" loading={request.isPending} fullWidth>
            {t("submit")}
          </Button>
        </form>
      )}
    </details>
  );
}
