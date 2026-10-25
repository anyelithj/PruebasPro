// [PROXY] REST unario → agente blockchain Ethereum (backend activo: Nest | FastAPI).
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import { useRuntimeConfig } from '#imports';
import { ethereumChatSchema } from '~/shared/schemas/blockchain-ethereum.schema';
import { ok, resolveBackendBase } from '../../../utils/response';
import { validate } from '../../../utils/validate';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const provider = (getQuery(event).provider as string) || (config.public.apiProvider as string);
  const input = validate(ethereumChatSchema, await readBody(event));

  const base = resolveBackendBase(provider, {
    fastapiBaseUrl: config.fastapiBaseUrl as string,
    nestBaseUrl: config.nestBaseUrl as string,
  });

  try {
    const res = await $fetch(`${base}/blockchain/ethereum/chat`, {
      method: 'POST',
      body: { message: input.message, wallet: input.walletAddress },
    });
    return ok((res as { data?: unknown }).data ?? res, 'ethereum agent');
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `Agente Ethereum no disponible (${provider}): ${(e as Error).message}`,
    });
  }
});
