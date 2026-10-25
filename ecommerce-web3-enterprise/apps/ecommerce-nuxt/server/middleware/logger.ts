// logger.ts (Nitro server middleware) => log estructurado (JSON por línea) de cada petición: método, ruta, status y
// duración. Patrón Observer (escucha el evento "finish" de la respuesta). JSON en stdout => lo recogen Loki/ELK sin
// librerías (en lugar de Pino: 0 dependencias). Los assets estáticos no se registran (menos ruido y E/S de disco).
const STATIC = /^\/(_nuxt|__nuxt|_ipx|favicon|workbox-|sw\.js)/;

export default defineEventHandler((event) => {
  if (STATIC.test(event.path)) return;
  const started = performance.now();
  event.node.res.once("finish", () => {
    console.info(JSON.stringify({ level: "info", msg: "request", method: event.method, path: event.path.split("?")[0], status: event.node.res.statusCode, ms: Math.round(performance.now() - started) }));
  });
});
