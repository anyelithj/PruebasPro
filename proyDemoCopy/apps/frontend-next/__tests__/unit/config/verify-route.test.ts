// [Caso E · 2026-11-13]: ruta ÚNICA de verificación pública (/certificados/verificar) y redirección permanente de /verificar
// La verificación vive dentro de /certificados (que exige sesión) → la regla pública debe ganar | [Patrón]: Table-Driven
import nextConfig from "../../../next.config";
import { isProtectedPath } from "@/lib/constants";
import { VERIFY_PREFIX } from "@/config/angular";

describe("isProtectedPath", () => {
  it.each([
    ["/certificados/verificar", false],
    ["/certificados/verificar/AULA-ABCD-2345", false], // El QR del PDF: sin sesión
    ["/certificados", true], // «Mis certificados»: con sesión
    ["/certificados/otra", true],
    ["/ayuda/faq", false],
    ["/tutor", true],
    ["/", false],
  ])("%s → protegida=%s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("redirección de la ruta anterior del QR", () => {
  it("/verificar y /verificar/:code → /certificados/verificar (308 permanente, también en producción)", async () => {
    const env = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    const redirects = await nextConfig.redirects!();
    Object.assign(process.env, { NODE_ENV: env });
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/verificar", destination: VERIFY_PREFIX, permanent: true },
        { source: "/verificar/:code", destination: `${VERIFY_PREFIX}/:code`, permanent: true },
      ]),
    );
    expect(VERIFY_PREFIX).toBe("/certificados/verificar");
  });
});
