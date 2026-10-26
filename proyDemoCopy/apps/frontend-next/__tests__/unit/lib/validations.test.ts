// [Test schemas Zod]: loginSchema + registerSchema | [Patrón]: Unit Test | [Principio]: SSOT con backend
import { loginSchema, registerSchema, makeForgotPasswordSchema, makeResetPasswordSchema } from "@/lib/validations";

describe("loginSchema", () => {
  // [caso válido]: email + password >= 8
  it("acepta credenciales válidas", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "secret12",
    });
    expect(result.success).toBe(true);
  });

  // [email inválido]
  it("rechaza email con formato inválido", () => {
    const result = loginSchema.safeParse({ email: "no-es-email", password: "secret12" });
    expect(result.success).toBe(false);
  });

  // [password corto]: < 8 chars
  it("rechaza contraseña menor a 8 caracteres", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "password")).toBe(true);
    }
  });

  // [remember opcional]
  it("permite omitir remember (opcional)", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "secret12" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@test.com",
    password: "Secret12",
    confirmPassword: "Secret12",
    acceptTerms: true as const,
  };

  it("acepta un registro completo y válido", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  // [regex password]: debe tener mayúscula, minúscula y dígito
  it("rechaza contraseña sin mayúscula/minúscula/dígito", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "alllowercase",
      confirmPassword: "alllowercase",
    });
    expect(result.success).toBe(false);
  });

  // [refine cruzado]: password === confirmPassword
  it("rechaza cuando las contraseñas no coinciden", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Otra123A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });

  // [acceptTerms literal true]
  it("exige aceptar los términos (literal true)", () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  // [trim]: recorta espacios en nombres
  it("recorta espacios en firstName/lastName", () => {
    const result = registerSchema.safeParse({ ...valid, firstName: "  Ada  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.firstName).toBe("Ada");
  });

  // [Teléfono · 2026-10-24]: opcional · misma regex que NestJS (PHONE_PATTERN de @aula/shared-schemas) | `it.each` (Jest): tabla de casos
  it.each(["", "+57 300 123 4567", "(601) 555-1234"])("acepta teléfono %p", (phone) => {
    expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it.each(["abc1234567", "12345"])("rechaza teléfono %p con mensaje en phone", (phone) => {
    const result = registerSchema.safeParse({ ...valid, phone });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["phone"]);
  });
});

// [Recuperar / restablecer contraseña]: correo válido y misma regla fuerte que el registro (DRY)
describe("makeResetPasswordSchema / makeForgotPasswordSchema", () => {
  it("exige contraseña fuerte y confirmación igual", () => {
    const s = makeResetPasswordSchema();
    expect(s.safeParse({ newPassword: "Abcdefg1", confirmPassword: "Abcdefg1" }).success).toBe(true);
    expect(s.safeParse({ newPassword: "abcdefg1", confirmPassword: "abcdefg1" }).success).toBe(false);
    expect(s.safeParse({ newPassword: "Abcdefg1", confirmPassword: "Abcdefg2" }).success).toBe(false);
  });
  it("valida el correo", () => {
    expect(makeForgotPasswordSchema().safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(makeForgotPasswordSchema().safeParse({ email: "nope" }).success).toBe(false);
  });
});
