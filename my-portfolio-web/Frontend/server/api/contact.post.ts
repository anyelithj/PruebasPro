// [MVC-C][SRP] handler único de contacto — valida (Zod) y reenvía al backend elegido.
import { defineEventHandler, readBody, getQuery, getRequestIP, createError } from 'h3';
import { useRuntimeConfig } from '#imports';
import { contactSchema } from '~/shared/schemas/contact.schema';
import { ok, resolveBackendBase } from '../utils/response';
import { validate } from '../utils/validate';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const provider = (getQuery(event).provider as string) || (config.public.apiProvider as string);
  const body = validate(contactSchema, await readBody(event));

  const base = resolveBackendBase(provider, {
    fastapiBaseUrl: config.fastapiBaseUrl as string,
    nestBaseUrl: config.nestBaseUrl as string,
  });

  // Sin esta cabecera el backend solo vería la IP de Nitro, no la del visitante.
  const clientIp = getRequestIP(event, { xForwardedFor: true });

  try {
    const res = await $fetch(`${base}/contact`, {
      method: 'POST',
      body,
      headers: clientIp ? { 'x-forwarded-for': clientIp } : {},
    });
    return ok(res, 'Contact submitted');
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `Backend contact unavailable (${provider}): ${(e as Error).message}`,
    });
  }
});
