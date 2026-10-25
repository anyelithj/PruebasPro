// [PROXY] REST unario → agente blockchain Solana (backend activo: Nest | FastAPI).
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import { useRuntimeConfig } from '#imports';
import { solanaChatSchema } from '~/shared/schemas/blockchain-solana.schema';
import { ok, resolveBackendBase } from '../../../utils/response';
import { validate } from '../../../utils/validate';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const provider = (getQuery(event).provider as string) || (config.public.apiProvider as string);
  const input = validate(solanaChatSchema, await readBody(event));

  const base = resolveBackendBase(provider, {
    fastapiBaseUrl: config.fastapiBaseUrl as string,
    nestBaseUrl: config.nestBaseUrl as string,
  });

  try {
    const res = await $fetch(`${base}/blockchain/solana/chat`, {
      method: 'POST',
      body: { message: input.message, wallet: input.walletAddress },
    });
    return ok((res as { data?: unknown }).data ?? res, 'solana agent');
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `Agente Solana no disponible (${provider}): ${(e as Error).message}`,
    });
  }
});
