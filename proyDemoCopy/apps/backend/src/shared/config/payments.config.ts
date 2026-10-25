import { z } from 'zod';
// [Configuración de pagos · Sprint 7.3]: claves de Stripe (modo prueba), secreto del webhook y URL de regreso validadas con Zod al arrancar | [Patrón]: Configuration Object + Parse, don't validate | [Principio]: Fail Fast + SSOT (un solo lugar lee STRIPE_*) | [Paradigma]: Funcional
// [Modos]: sin STRIPE_SECRET_KEY → pagos desactivados (la compra de demostración de /courses/:id/purchase sigue activa) · con clave → los cursos de pago solo se desbloquean con el webhook de la pasarela
// [Seguridad]: los mensajes de error nombran la variable, nunca su valor | se recomienda una clave restringida (rk_test_…) con permisos de Checkout Sessions y Refunds

const PaymentsSchema = z.object({
  // `rk_` (restringida, recomendada) o `sk_` (secreta) · solo modo prueba en este proyecto
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^(rk|sk)_test_/, 'usa una clave de prueba (rk_test_… o sk_test_…)')
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(), // `stripe listen --print-secret` en local
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_test_').optional(), // Pública: viaja al navegador con la sesión (Stripe.js)
  // `{ORDER_ID}` y `{PAYMENT_ID}` los sustituye el backend (la pantalla consulta el estado del pago por id)
  PAYMENTS_RETURN_URL: z.string().includes('{PAYMENT_ID}').optional(),
  FRONTEND_URL: z.url().default('http://localhost:9000'),
});

export interface PaymentsConfig {
  enabled: boolean; // true solo con STRIPE_SECRET_KEY
  secretKey?: string;
  webhookSecret?: string;
  publishableKey?: string;
  returnUrl: string; // Plantilla con {ORDER_ID} y {PAYMENT_ID}
}

// [loadPaymentsConfig]: lectura pura del entorno → objeto tipado | variables vacías = no definidas
export function loadPaymentsConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaymentsConfig {
  const defined = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== ''),
  );
  const result = PaymentsSchema.safeParse(defined);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    ); // Solo nombre + mensaje (sin valores)
    throw new Error(`Configuración de pagos inválida → ${issues.join(' · ')}`);
  }
  const c = result.data;
  return {
    enabled: !!c.STRIPE_SECRET_KEY && !!c.STRIPE_PUBLISHABLE_KEY, // Sin la pública el navegador no puede montar el formulario
    secretKey: c.STRIPE_SECRET_KEY,
    webhookSecret: c.STRIPE_WEBHOOK_SECRET,
    publishableKey: c.STRIPE_PUBLISHABLE_KEY,
    // [Pantalla de confirmación]: Angular /checkout/confirmacion/:orderId (sprint 7.4) bajo el shell de Next.js
    returnUrl:
      c.PAYMENTS_RETURN_URL ??
      `${c.FRONTEND_URL.replace(/\/$/, '')}/checkout/confirmacion/{ORDER_ID}?pago={PAYMENT_ID}`,
  };
}

// [paymentsConfig]: memo por proceso | [Patrón]: Lazy Singleton
let cached: PaymentsConfig | undefined;
export function paymentsConfig(): PaymentsConfig {
  return (cached ??= loadPaymentsConfig());
}

// [validatePaymentsEnv]: gancho `validate` de ConfigModule → el backend no arranca con claves mal puestas | [Principio]: Fail Fast
export function validatePaymentsEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  loadPaymentsConfig(env as NodeJS.ProcessEnv);
  return env;
}
