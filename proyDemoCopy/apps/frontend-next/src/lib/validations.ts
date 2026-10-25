import { z } from "zod";
// [Validaciones Zod]: schemas runtime usados en formularios + Route Handlers | [Patrón]: Schema Validation | [Principio]: SSOT + DRY | [Paradigma]: Funcional + Declarativo

// [Login]: mismas reglas que backend NestJS LoginDto
// [Mensajes de validación de auth]: se inyectan según el idioma → el mismo esquema sirve en ES y EN | [Patrón]: Factory | [Principio]: DRY + OCP
export interface AuthMessages {
  emailRequired: string;
  emailInvalid: string;
  passwordMin: string;
  passwordMax: string;
  passwordRule: string;
  firstNameRequired: string;
  firstNameMax: string;
  lastNameRequired: string;
  lastNameMax: string;
  mismatch: string;
  terms: string;
}

// [Mensajes por defecto (ES)]: los de siempre → los esquemas estáticos y sus tests no cambian
const DEFAULT_AUTH_MESSAGES: AuthMessages = {
  emailRequired: "El correo es obligatorio",
  emailInvalid: "Formato de correo inválido",
  passwordMin: "La contraseña debe tener al menos 8 caracteres",
  passwordMax: "Máximo 128 caracteres",
  passwordRule: "Debe incluir mayúscula, minúscula y dígito",
  firstNameRequired: "El nombre es obligatorio",
  firstNameMax: "Nombre demasiado largo",
  lastNameRequired: "El apellido es obligatorio",
  lastNameMax: "Apellido demasiado largo",
  mismatch: "Las contraseñas no coinciden",
  terms: "Debes aceptar los términos para continuar",
};

// [makeLoginSchema]: esquema de login con mensajes del idioma activo
export const makeLoginSchema = (m: AuthMessages = DEFAULT_AUTH_MESSAGES) =>
  z.object({
    email: z.string().min(1, m.emailRequired).email(m.emailInvalid),
    password: z.string().min(8, m.passwordMin),
    // [remember]: optional sin default — evita mismatch input/output con zodResolver | [Principio]: KISS
    remember: z.boolean().optional(),
  });

export const loginSchema = makeLoginSchema(); // [Compatibilidad]: export estático en español

// [Tipo del FORM]: usa z.input (boolean | undefined) — RHF necesita la forma del input, no del output post-default
export type LoginInput = z.input<typeof loginSchema>;

// [strongPassword]: regla de contraseña fuerte compartida por registro y restablecimiento | [Patrón]: Factory | [Principio]: DRY + SSOT
// Regex con lookaheads `(?=…)` (ES3): exige minúscula, mayúscula y dígito — igual que el backend NestJS
const strongPassword = (m: AuthMessages) =>
  z.string().min(8, m.passwordMin).max(128, m.passwordMax).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, m.passwordRule);

// [Register]: regex coincide con backend (upper + lower + digit) | [Principio]: SSOT
export const makeRegisterSchema = (m: AuthMessages = DEFAULT_AUTH_MESSAGES) =>
  z
    .object({
      firstName: z.string().trim().min(1, m.firstNameRequired).max(80, m.firstNameMax),
      lastName: z.string().trim().min(1, m.lastNameRequired).max(80, m.lastNameMax),
      email: z.string().min(1, m.emailRequired).email(m.emailInvalid),
      password: strongPassword(m),
      confirmPassword: z.string(),
      acceptTerms: z.literal(true, { message: m.terms }),
    })
    // [refine]: validación cruzada (password === confirmPassword) | [Principio]: DRY
    .refine((data) => data.password === data.confirmPassword, { message: m.mismatch, path: ["confirmPassword"] });

export const registerSchema = makeRegisterSchema(); // [Compatibilidad]: export estático en español

export type RegisterInput = z.infer<typeof registerSchema>;

// [Recuperar contraseña]: solo el correo (mismo mensaje que login) | [Patrón]: Factory
export const makeForgotPasswordSchema = (m: AuthMessages = DEFAULT_AUTH_MESSAGES) =>
  z.object({ email: z.string().trim().min(1, m.emailRequired).email(m.emailInvalid) });

export type ForgotPasswordInput = z.infer<ReturnType<typeof makeForgotPasswordSchema>>; // `ReturnType` (TS): tipo inferido de la fábrica

// [Restablecer contraseña]: nueva contraseña fuerte + confirmación cruzada con `refine` (Zod) | [Principio]: DRY
export const makeResetPasswordSchema = (m: AuthMessages = DEFAULT_AUTH_MESSAGES) =>
  z
    .object({ newPassword: strongPassword(m), confirmPassword: z.string() })
    .refine((d) => d.newPassword === d.confirmPassword, { message: m.mismatch, path: ["confirmPassword"] });

export type ResetPasswordInput = z.infer<ReturnType<typeof makeResetPasswordSchema>>;
