"use client"; // [Next.js]: Client Component → React Hook Form necesita estado en el navegador
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form"; // [RHF]: formulario no controlado con validación por esquema
import { zodResolver } from "@hookform/resolvers/zod"; // [Adapter]: Zod → RHF
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input"; // [2026-10-23]: icono de ojo para ver/ocultar | [Principio]: DRY (mismo componente que login/registro)
import { toast } from "@/components/shared/Toaster";
import { optionalPhone } from "@/lib/validations"; // [2026-10-24]: regla de teléfono única (registro, perfil y Gestión) | [Principio]: DRY
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER } from "@aula/shared-schemas"; // [2026-10-24]: límite y ejemplo compartidos | [Principio]: SSOT
// [UserForm]: formulario ÚNICO de alta y edición de usuario (con `initial` edita, sin él crea) | [Patrón]: Presentational + Strategy (POST/PATCH según modo) | [Principio]: SRP + DRY | [Paradigma]: Declarativo

// [Campos comunes]: los que se editan en ambos modos | [Principio]: DRY
const baseSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre obligatorio").max(80),
  lastName: z.string().trim().min(1, "Apellido obligatorio").max(80),
  role: z.enum(["USER", "TEACHER", "ADMIN"]),
  section: z.string().trim().max(40).optional(),
  // [Teléfono · 2026-10-24]: opcional, misma regla que el DTO de NestJS (vacío = sin teléfono)
  phone: optionalPhone({ phoneInvalid: "Teléfono no válido: solo números, espacios, guiones y + inicial" }), // `optionalPhone` (Factory Zod): PHONE_PATTERN de @aula/shared-schemas
});

// [Alta]: además email y contraseña (el backend no los cambia en la edición) | `.extend` (Zod): hereda los campos base
const createSchema = baseSchema.extend({
  email: z.string().trim().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Debe incluir mayúscula, minúscula y dígito"),
  confirmPassword: z.string(), // [2026-10-23]: repetir contraseña
}).refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden" }); // `refine` (Zod): regla entre campos

// `z.input` (Zod): forma de los valores del formulario | `Partial` para email/password: solo existen en alta
type UserFormValues = z.input<typeof baseSchema> & Partial<Pick<z.input<typeof createSchema>, "email" | "password" | "confirmPassword">>;
type Role = UserFormValues["role"];

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "USER", label: "Estudiante" },
  { value: "TEACHER", label: "Docente" },
  { value: "ADMIN", label: "Administrador" },
];

export interface UserFormProps {
  // `?` (TS): presente → modo edición
  initial?: { id: string; email: string; firstName: string; lastName: string; role: Role; section?: string | null; phone?: string | null };
}

export function UserForm({ initial }: UserFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? baseSchema : createSchema), // [Strategy]: esquema según el modo
    defaultValues: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      email: initial?.email ?? "",
      password: "",
      confirmPassword: "",
      role: initial?.role ?? "USER",
      section: initial?.section ?? "",
      phone: initial?.phone ?? "",
    },
  });

  // [Sección]: solo aplica a estudiantes (USER). Docente/Admin no tienen sección
  const isStudent = watch("role") === "USER";

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // [Normaliza]: si no es estudiante, se limpia la sección | en edición no viajan email ni contraseña
      const section = values.role === "USER" ? values.section : "";
      const payload = isEdit
        ? { firstName: values.firstName, lastName: values.lastName, role: values.role, section, phone: values.phone }
        : { email: values.email, password: values.password, firstName: values.firstName, lastName: values.lastName, role: values.role, section, phone: values.phone }; // confirmPassword no viaja (solo validación local)
      const res = await fetch(isEdit ? `/api/admin/users/${initial!.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      toast("success", isEdit ? "Usuario editado con éxito." : "Usuario creado con éxito."); // [2026-10-19]: aviso visible tras guardar
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5" noValidate>
      {submitError && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre *</Label>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido *</Label>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email *</Label>
        {/* [Edición]: email visible pero de solo lectura (identidad de la cuenta) | `readOnly` sigue siendo enfocable y legible por lectores */}
        <Input id="email" type="email" autoComplete="email" readOnly={isEdit} aria-describedby={isEdit ? "email-hint" : undefined} {...register("email")} />
        {isEdit && (
          <p id="email-hint" className="text-xs text-muted-foreground">
            El email y la contraseña no se editan desde aquí. Cada usuario cambia su contraseña en «Mi perfil».
          </p>
        )}
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {/* [Teléfono · 2026-10-24]: `type="tel"` + `autoComplete="tel"` (HTML) → teclado telefónico en móvil y autocompletado */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={PHONE_PLACEHOLDER} maxLength={PHONE_MAX_LENGTH} aria-describedby="phone-hint" {...register("phone")} />
        <p id="phone-hint" className="text-xs text-muted-foreground">Opcional. Con indicativo del país.</p>
        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      {/* [Alta]: contraseña + confirmación con icono de ojo | [Responsive]: 2 columnas desde sm */}
      {!isEdit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña *</Label>
            <PasswordInput id="password" autoComplete="new-password" aria-describedby="password-hint" {...register("password")} />
            <p id="password-hint" className="text-xs text-muted-foreground">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Repetir contraseña *</Label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role">Rol *</Label>
          <select id="role" className="control w-full" {...register("role")}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {isStudent && (
          <div className="space-y-1.5">
            <Label htmlFor="section">Sección / grupo</Label>
            <Input id="section" placeholder="Ej. 11-1, A, 2024-2" aria-describedby="section-hint" {...register("section")} />
            {/* [UX 2026-10-23]: explica para qué sirve el campo (la usuaria no lo entendía) */}
            <p id="section-hint" className="text-xs text-muted-foreground">Opcional. Grupo o salón del estudiante; el docente filtra y compara estudiantes por sección.</p>
            {errors.section && <p className="text-xs text-destructive">{errors.section.message}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={submitting}>
          Cancelar
        </Button>
        {/* [Edición sin cambios]: botón deshabilitado → evita PATCH vacíos */}
        <Button type="submit" disabled={submitting || (isEdit && !isDirty)}>
          {isEdit ? (submitting ? "Guardando..." : "Guardar cambios") : submitting ? "Creando..." : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
