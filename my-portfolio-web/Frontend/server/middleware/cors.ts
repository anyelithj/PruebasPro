// [CHAIN-OF-RESPONSIBILITY] headers CORS globales para las rutas del BFF Nitro.
import { defineEventHandler, setResponseHeaders, getMethod, setResponseStatus } from 'h3';

export default defineEventHandler((event) => {
  if (!event.path?.startsWith('/api/')) return;

  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204);
    return '';
  }
});
