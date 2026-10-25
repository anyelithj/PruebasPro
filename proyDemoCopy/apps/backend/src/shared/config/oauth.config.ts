import { registerAs } from '@nestjs/config';
// [Configuración OAuth]: client IDs y tenants para verificación de id_token | [Patrón]: Configuration Object | [Principio]: SSOT

export default registerAs('oauth', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
  },
}));
