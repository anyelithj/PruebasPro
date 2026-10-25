// PhoneVerification.tsx (Client Component · React + TanStack Query + Tailwind) => RF-01.1 verificación del celular.
// Flujo de 2 pasos: "Enviar código" (SMS) -> escribir el código de 6 dígitos -> "Verificar". El estado del paso es local
// (useState: solo importa a esta tarjeta). Si el usuario cambia el número en el perfil, el backend anula la verificación.
// Patrones: State (paso "idle" -> "code"), Facade (useSettingsActions). Accesibilidad: estado con texto (no solo color),
// autocomplete="one-time-code" (el celular sugiere el código del SMS) e inputMode numérico.
"use client"; // Directiva de Next.js: usa hooks => Client Component

import { useState } from "react"; // Hook de estado local de React
import { useTranslations } from "next-intl";
import { useProfile } from "@/entities/user/api/user.api";
import { useSettingsActions } from "../api/settings.api";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { toast } from "@/shared/ui/Toast";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";

export function PhoneVerification() {
  const t = useTranslations("settings.phone");
  const errorMessage = useErrorMessage();
  const { data: profile } = useProfile();
  const { requestPhoneCode, verifyPhone } = useSettingsActions();
  const [challengeId, setChallengeId] = useState<string | null>(null); // null => aún no se pidió el código
  const [code, setCode] = useState("");

  if (!profile) return null; // El perfil carga en ProfileSettings (mismo caché de TanStack Query)
  const onError = (error: unknown) => toast.error(errorMessage(error));

  return (
    <section aria-labelledby="phone-title" className="flex max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 id="phone-title" className="text-lg font-semibold">{t("title")}</h2>
        {/* Texto + color: el estado no depende solo del color (WCAG 1.4.1) */}
        {profile.phone && <Badge tone={profile.phoneVerified ? "success" : "warning"}>{profile.phoneVerified ? t("verified") : t("unverified")}</Badge>}
      </div>

      {!profile.phone ? (
        <p className="text-sm text-slate-600">{t("missing")}</p>
      ) : profile.phoneVerified ? null : (
        <>
          {challengeId && <p role="status" className="text-sm text-slate-600">{t("sent")}</p>}
          {challengeId && (
            <Input label={t("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
          )}
          <div className="flex flex-wrap gap-2">
            {challengeId && (
              <Button
                loading={verifyPhone.isPending}
                disabled={code.length !== 6}
                onClick={() => verifyPhone.mutate({ challengeId, code }, { onSuccess: () => { setChallengeId(null); setCode(""); toast.success(t("success")); }, onError })}
              >
                {t("verify")}
              </Button>
            )}
            <Button variant="secondary" loading={requestPhoneCode.isPending} onClick={() => requestPhoneCode.mutate(undefined, { onSuccess: (challenge) => setChallengeId(challenge.challengeId), onError })}>
              {challengeId ? t("resend") : t("send")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
