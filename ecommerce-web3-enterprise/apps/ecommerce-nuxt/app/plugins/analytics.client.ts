// analytics.client.ts (plugin de Nuxt, solo navegador por el sufijo ".client") => registra un page_view en cada
// navegación y envía el buffer de eventos en lotes cada 30 s, al ocultar la pestaña y al cerrarla.
// Patrón Observer (router.afterEach + visibilitychange). Las rutas privadas del panel no se registran.
import { flush, track } from "~~/shared/lib/analytics";
import { AUTH_COOKIES } from "~~/shared/lib/auth-config";
import { ANALYTICS_FLUSH_MS } from "~~/shared/constants/config";
import { observeVitals, describeTarget } from "~~/shared/lib/vitals";

const PRIVATE = /\/(new|edit|social|config|pwa\/cache)(\/|$)/; // Pantallas de administración

export default defineNuxtPlugin((nuxtApp) => {
  const { public: config } = useRuntimeConfig();
  const token = useCookie<string | null>(AUTH_COOKIES.access);
  const send = () => flush(config.apiUrl, token.value);

  let first = true;
  nuxtApp.$router.afterEach((to) => {
    if (PRIVATE.test(to.path)) return;
    // El canal de origen (utm_source) y el referrer solo tienen sentido en la primera vista de la sesión
    const channel = typeof to.query["utm_source"] === "string" ? to.query["utm_source"] : undefined;
    track("page_view", first ? { ...(channel ? { channel } : {}), referrer: document.referrer.slice(0, 300) } : {});
    first = false;
  });

  // RF-24.8 mapa de calor: x en % del ancho, y en px del documento (máx. un clic cada 300 ms por página)
  let lastClick = 0;
  document.addEventListener("click", (event) => {
    if (PRIVATE.test(window.location.pathname) || Date.now() - lastClick < 300) return;
    lastClick = Date.now();
    const doc = document.documentElement;
    track("click", {
      metadata: {
        x: Math.round((event.pageX / Math.max(1, doc.scrollWidth)) * 1000) / 10,
        y: Math.round(event.pageY),
        h: doc.scrollHeight,
        device: window.innerWidth < 768 ? "mobile" : "desktop",
        el: describeTarget(event.target),
      },
    });
  }, { capture: true, passive: true });
  // RF-24.8 Web Vitals (LCP, CLS, INP, TTFB, carga) por página: se envían al ocultar la pestaña o cambiar de ruta
  observeVitals((vitals) => !PRIVATE.test(window.location.pathname) && track("web_vital", { metadata: { ...vitals } }));

  window.setInterval(send, ANALYTICS_FLUSH_MS);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send());
});
