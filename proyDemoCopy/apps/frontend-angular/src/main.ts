// [Bootstrap · Angular 22]: un solo punto de entrada con dos modos, cada uno cargado bajo demanda | [Patrón]: Strategy (modo según el documento anfitrión) + Lazy Loading | [Principio]: DRY (mismo bundle para pantallas completas y widgets) | [Rendimiento]: main.js solo decide; el resto baja en chunks
// - Pantalla completa (index.html con <aula-root>, servida por los rewrites de Next.js): bootstrapApplication
// - Página de Next.js que carga /ng/main.js: solo registra los Angular Elements (<aula-exportar>, <aula-campana>)

// `import()` dinámico (ES2020): el bundler separa cada rama en su propio chunk
const start: Promise<unknown> = document.querySelector('aula-root')
  ? Promise.all([import('@angular/platform-browser'), import('./app/app.component'), import('./app/app.config')]).then(
      ([{ bootstrapApplication }, { AppComponent }, { appConfig }]) => bootstrapApplication(AppComponent, appConfig),
    )
  : import('./app/elements').then((m) => m.registerElements());

// `.catch` (Promise): un fallo de arranque se registra sin romper la página anfitriona
start.catch((err: unknown) => console.error(err));
