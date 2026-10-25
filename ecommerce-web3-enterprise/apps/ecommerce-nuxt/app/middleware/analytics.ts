// analytics.ts (route middleware de Nuxt, con nombre) => guarda el origen de la visita (utm_source / utm_campaign)
// la primera vez que se entra a una landing, para atribuir el lead a su campaña (Observer de navegación).
// sessionStorage => dura lo que la pestaña; sin cookies de rastreo de terceros.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return; // El origen se guarda solo en el navegador
  const source = [to.query["utm_source"], to.query["utm_campaign"]].filter((value) => typeof value === "string" && value).join("/");
  if (!source) return;
  try {
    sessionStorage.setItem("nuxt-lead-source", source.slice(0, 120));
  } catch {
    // Modo privado sin almacenamiento: el lead se registra sin origen
  }
});
