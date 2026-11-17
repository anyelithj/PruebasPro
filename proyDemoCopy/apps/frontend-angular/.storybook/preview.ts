// [Storybook preview · Angular 22]: selector de tema + reglas a11y para TODAS las historias | [Patrón]: Decorator (envuelve cada historia) | [Principio]: DRY (configuración común en un solo sitio) | [Paradigma]: Funcional + Declarativo
// [Estilos]: src/styles.css llega por la opción `styles` del target `storybook` de angular.json (misma hoja Tailwind v4 que la app) | [Principio]: SSOT
import { provideRouter } from '@angular/router';
import { applicationConfig, componentWrapperDecorator, type Decorator, type Preview } from '@storybook/angular';
import { coreProviders } from '../src/app/app.config';

// [THEMES]: los 6 temas de @aula/ui-tokens (:root = claro) | [Principio]: SSOT (antes una copia local sin `vr`; un tema nuevo aparece aquí solo)
import { THEMES } from '@aula/ui-tokens/tailwind-preset';

// [withTheme]: aplica al <html> del iframe la clase del tema elegido en la barra de herramientas | [Patrón]: Decorator | [Principio]: OCP (tema nuevo = literal nuevo)
const withTheme: Decorator = (storyFn, context) => {
  // `context.globals` (Storybook): valores de la barra de herramientas | `??` (JS): valor por defecto
  const theme = (context.globals['theme'] as string | undefined) ?? 'light';
  const root = document.documentElement; // `document.documentElement` (DOM): <html>, donde la app pone la clase del tema
  root.classList.remove(...THEMES); // Spread (JS): deja un solo tema activo
  if (theme !== 'light') root.classList.add(theme);
  return storyFn(); // Devuelve la historia sin cambios: solo efecto sobre <html>
};

const preview: Preview = {
  decorators: [
    // `applicationConfig` (Storybook Angular): providers de entorno para TODAS las historias = los mismos `coreProviders` de la app (zoneless, HttpClient + interceptores, diccionario)
    // + `provideRouter([])` (Angular): RouterLink/RouterLinkActive sin rutas reales · sin `provideAuth()` → sesión anónima, sin llamadas de sesión al backend | [Patrón]: Composition Root | [Principio]: DRY
    applicationConfig({ providers: [...coreProviders, provideRouter([])] }),
    withTheme,
    // `componentWrapperDecorator` (Storybook Angular): envuelve la plantilla con fondo y texto de los tokens → contraste real del tema
    componentWrapperDecorator((story) => `<div class="bg-background text-foreground p-6">${story}</div>`),
  ],
  globalTypes: {
    theme: {
      description: 'Tema de la plataforma',
      toolbar: { title: 'Tema', icon: 'paintbrush', items: [...THEMES], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'error' }, // Violación de axe = historia fallida (Sprint 11.2: calidad antes de producción)
  },
  tags: ['autodocs'], // Documentación generada desde los input() | [Principio]: Documentación viva
};

export default preview;
