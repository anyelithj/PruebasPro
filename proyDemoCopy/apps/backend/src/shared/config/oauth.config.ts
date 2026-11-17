import { registerAs } from '@nestjs/config';
// [Configuración OAuth]: client IDs y tenants para verificación de id_token | [Patrón]: Configuration Object | [Principio]: SSOT

export default registerAs('oauth', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
}));
