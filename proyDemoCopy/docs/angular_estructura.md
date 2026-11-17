# Angular 22 — Estructura de Carpetas

## Tipo de Arquitectura

**Angular Microfrontend · Feature-Based Clean Architecture with Atomic Design**

| Parte del nombre        | Implementación en Angular 22                                                                                                              |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| **Angular Microfrontend** | `apps/frontend-angular` es un remoto que el shell de Next.js compone: pantallas completas por *rewrites* (`/checkout`, `/juegos`, `/musica`, `/poliglota`…) y widgets pequeños como Angular Elements (`<aula-word-lookup>`, `<aula-ipa-text>`). Mismo origen, sesión en cookie httpOnly, `/api/*` del BFF y eventos `aula:*`. Se despliega por separado (`:9100`) |
| **Feature-Based**       | Una carpeta por funcionalidad en `features/<nombre>/` (corte vertical). Cada una se carga bajo demanda y **no importa a otra**: se comunica por el router, por eventos o por `core` / `shared` |
| **Clean Architecture**  | Cuatro capas dentro de cada funcionalidad: `domain` · `application` · `infrastructure` · `presentation`. Las dependencias van hacia adentro; `infrastructure` implementa los puertos del dominio. La lógica de negocio sigue en NestJS: las capas son finas |
| **Atomic Design**       | Componentes reutilizables en `shared/ui/{atoms, molecules, organisms, templates}`. Átomo → nada; molécula → átomos; organismo → moléculas y átomos; plantilla → organismos; las páginas viven en cada funcionalidad |
| **MVC** (equivalencia)  | No se aplica como capa aparte. Modelo = `domain` · Vista = `presentation/components` · Controlador = `presentation/pages` + `application` |
| **BFF**                 | Se reutiliza el de Next.js (`/api/*`); `core/http` envuelve `HttpClient`. Angular no tiene BFF propio |
| **Estado y módulos**    | Signals + RxJS y componentes standalone, sin NgModules ni NgRx. El estado de la funcionalidad vive en la fachada (`application`); el global solo en `core` (sesión, tema, idioma) |

**Capas Clean Architecture por funcionalidad (`features/<nombre>/`):**
- **Domain**: `models/` (tipos + esquemas Zod), reglas puras (por ejemplo `language-order.ts` en poliglota) y `<nombre>.repository.port.ts` (clase abstracta + `InjectionToken`)
- **Application**: `<nombre>.facade.ts` (casos de uso como métodos + estado con signals) y `*.resource.ts` (`resource()`)
- **Infrastructure**: `<nombre>.http-repository.ts` (único lugar con `HttpClient`, hacia `/api/*`) y `*.stream.ts` (SSE)
- **Presentation**: `pages/` (contenedores) + `components/` (presentacionales con `input()` / `output()`) + `pipes/`

**Patrones de Diseño:** Container/Presentational · Facade · Port/Adapter (Hexagonal) · Repository · Observer (signals, SSE) · Adapter (`*.http-repository.ts`) · Máquina de estados (carga → éxito/vacío/error) · Strategy · Pipe de Angular

**Paradigmas (en el código desde 2026-10-15):** Declarativo (plantillas de Angular) · Reactivo (signals; RxJS solo en flujos SSE y HTTP) · Funcional (funciones puras e inmutabilidad en `domain/`). `async/await` es un mecanismo de asincronía, no un paradigma

**Prácticas:** SOLID (SRP: página contenedor + componente de UI · DIP: la presentación depende de la fachada) · DRY (esquemas Zod, i18n y tokens de diseño compartidos con Next.js) · Type-Safe (TS strict + Zod) · Reglas de capas verificadas con ESLint (`no-restricted-imports`) · A11y (WCAG 2.1 AA) · Responsive (Tailwind) · Rutas protegidas (`role.guard.ts` + sesión del shell)

**Tecnologías:** Angular 22 · TypeScript · Signals + RxJS · Signal Forms · Tailwind CSS 4 · tw-animate-css · Zod · @angular/cdk (DragDrop) · @angular/elements · viem (EIP-6963, SIWE y sendTransaction en Sepolia) · @stripe/stripe-js · marked + DOMPurify · EventSource (SSE) · Jest · msw · Playwright · ESLint · Prettier · Storybook 10 (@storybook/angular) · TypeDoc

**Nota — Sin Module Federation:** Next.js es el *host* (login, layout, navegación y BFF) y Angular el remoto. La integración es por rutas (*rewrites*), Angular Elements y eventos `aula:*`; no se usa Module Federation (capítulo 15 del informe).

**Nota — Marco común (2026-10-16):** las pantallas Angular usan el MISMO sidebar y topbar que Next.js (`shared/ui/organisms/portal-sidebar` y `portal-topbar`): ítems por rol, textos, iconos lucide, temas, idioma, carrito y cookie del menú salen de `packages/shared-nav`, `packages/ui-tokens` y `packages/shared-i18n` (alias `@aula/*`, Sprint 7.1). Para el usuario es una sola aplicación.

**Nota — Web3 (2026-10-16):** `core/web3/` (chains.ts + viem-client.ts) y `features/web3/` implementados (sprint 7.7): `/wallet` descubre billeteras con EIP-6963 y las vincula firmando SIWE (EIP-4361) con viem; `/checkout/cripto` paga la orden con ETH de prueba en Sepolia (`sendTransaction`) y sigue las confirmaciones en vivo por SSE (`/api/events`, evento `crypto-payment`) hasta que NestJS la marca pagada.

**Nota — Pagos (2026-10-16):** `features/payments/` implementada (sprint 7.4): `/checkout` monta el checkout embebido de Stripe (`@stripe/stripe-js`, Checkout Sessions `embedded_page`) con la orden que calcula NestJS (sprint 7.3), `/checkout/confirmacion/:orderId` consulta el estado con `resource()` hasta que el webhook confirma, y `/pagos` muestra el historial con reembolso para ADMIN. Sin claves de Stripe en el servidor (503) ofrece la compra de demostración.

**Nota — Estado (2026-10-15):** `apps/frontend-angular` existe (Angular 22.2, zoneless, Jest + msw, ESLint por capas). Implementadas las funcionalidades de las fases 0–6: **Shared** (esqueleto core/shared, sprint 7.20), **Assistant** (/tutor, 5.3), **Feedback** (/estudio/*, 5.2), **OwnLlm** (/redaccion, 5.6), **Notifications** (/notificaciones + `<aula-campana>`) y **Reports** (/reportes/exportaciones + `<aula-exportar>`). El resto de archivos de esta estructura siguen **previstos** para las fases 7 y 9–11; el estado de cada requerimiento está en la hoja «Plan de Trabajo» de la matriz.

**Nota — Ejecución:** Angular 22 exige Node ≥ 22.22.3 (`nvm use 22.22.3`). `pnpm start` sirve en `:9100/ng/` y Next.js (`:9000`) reescribe las pantallas; `styles.css` importa `apps/frontend-next/src/app/globals.css` (mismos 6 temas y utilidades).

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «🅰️ Angular 22», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/frontend-angular/                                           # Angular Microfrontend + Feature-Based Clean Architecture + Atomic Design · remoto :9100
├── scripts/
│   └── serve-dist.mjs                                           # sirve el build de producción de Angular (ng build) en :9100 bajo /ng/ — sin `ng serve` (que compila en caliente)
├── src/                                                         # Código fuente de la aplicación
│   ├── app/                                                     # Código de la aplicación
│   │   ├── core/                                                # Una sola vez en toda la app (no importa nada de la app)
│   │   │   ├── audio/
│   │   │   │   ├── audio-audibility.ts                          # ¿el audio descargado del servidor SUENA? (decodifica y mide RMS)
│   │   │   │   ├── lip-sync.service.ts                          # Abre y cierra la boca según el volumen (Web Audio API, AnalyserNode)
│   │   │   │   ├── server-audio.service.ts                      # Audio del servidor (nube) + copia local (Cache Storage) + respaldo a la voz del navegador · 2026-10-19
│   │   │   │   ├── server-speech.ts                             # ¿puede el servidor transcribir? y qué decir al alumno si no (dictado del navegador o escribir)
│   │   │   │   └── speech-synthesis.service.ts                  # Voz del navegador (en-GB o en-US según el interruptor)
│   │   │   ├── auth/                                            # Sesión compartida con el shell de Next.js
│   │   │   │   ├── auth.providers.ts                            # Providers de sesión y guards
│   │   │   │   ├── role.guard.ts                                # Guard funcional por rol (STUDENT / TEACHER / ADMIN)
│   │   │   │   └── session.service.ts                           # Lee la sesión desde /api/auth/session (signals)
│   │   │   ├── cart/                                            # Carrito compartido con Next.js
│   │   │   │   └── cart.service.ts                              # Mismo localStorage «cart» que useCart de Next.js; compra por /api/courses/:id/purchase
│   │   │   ├── dictionary/                                      # Diccionario al hacer clic en una palabra (lo usan los textos de toda la app)
│   │   │   │   ├── dictionary.facade.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: consultar palabra y marcar «aprender» / «aprendido»
│   │   │   │   ├── dictionary.http-repository.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador HTTP hacia /api/vocabulary/lookup/word
│   │   │   │   ├── dictionary.model.ts                          # Tipos y esquemas Zod de la entrada del diccionario
│   │   │   │   └── dictionary.repository.port.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio
│   │   │   ├── events/                                          # Comunicación con el shell de Next.js
│   │   │   │   └── aula-events.service.ts                       # Publica y escucha los eventos aula:* (por ejemplo aula:navigate)
│   │   │   ├── feedback/                                        # Avisos breves (toasts) · 2026-10-19
│   │   │   │   └── toast.service.ts                             # Publica aula:toast; lo pinta el shell activo (Next.js o Angular)
│   │   │   ├── http/                                            # Envuelve HttpClient: Angular no tiene BFF propio, usa /api/* de Next.js
│   │   │   │   ├── api-url.token.ts                             # InjectionToken con la base de /api/*
│   │   │   │   ├── busy.interceptor.ts                          # mientras haya un alta, edición o borrado en curso → indicador global «Cargando… puede tardar unos minutos» (BusyOverlayC…
│   │   │   │   ├── credentials.interceptor.ts                   # withCredentials: la sesión viaja en cookie httpOnly
│   │   │   │   ├── envelope.interceptor.ts                      # Desenvuelve { statusCode, data, meta } de NestJS (la ruta comodín del BFF lo deja pasar)
│   │   │   │   ├── error.interceptor.ts                         # Errores comunes (401 → shell, 403, 5xx) hacia un mensaje legible
│   │   │   │   ├── notify.interceptor.ts                        # Aviso de éxito en altas, ediciones y borrados (2xx) · 2026-10-19
│   │   │   │   └── http.providers.ts                            # provideHttpClient(withFetch(), withInterceptors([...]))
│   │   │   ├── i18n/
│   │   │   │   ├── i18n.service.ts                              # Textos ES/EN desde packages/shared-i18n
│   │   │   │   └── locale.token.ts                              # InjectionToken del idioma activo
│   │   │   ├── layout/                                          # Estado del marco del portal (sidebar y topbar)
│   │   │   │   ├── not-found.page.ts                            # 404 del remoto Angular (antes '**' redirigía a /tutor y ocultaba el enlace roto)
│   │   │   │   ├── portal-nav.service.ts                        # Drawer móvil y sidebar oculto (cookie sidebar-collapsed compartida con Next.js)
│   │   │   │   ├── prefill.ts                                   # idioma y nivel elegidos en Gestión → Crear actividad llegan como ?idioma=&nivel= y los editores los usan como valor inic…
│   │   │   │   └── return-to.ts                                 # «volver» al lugar de donde se vino — Gestión → Actividades abre los editores con ?volver=/admin/activities?tab=… y, al t…
│   │   │   ├── media/
│   │   │   │   └── text-import.service.ts                       # texto de un archivo (PDF, Word .docx, texto, imagen con OCR) o de un enlace → Route Handler de Next.js /api/media/extrac…
│   │   │   ├── routing/
│   │   │   │   ├── chunk-reload.ts                              # «Failed to fetch dynamically imported module: /ng/chunk-XXXX.js» → el remoto se recompiló o se desplegó y esa pantalla a…
│   │   │   │   └── idle-preloading.strategy.ts                  # precarga las funcionalidades lazy cuando el navegador queda ocioso, no en cuanto se pinta la primera pantalla
│   │   │   ├── theme/
│   │   │   │   └── theme.service.ts                             # Tema activo (6 temas de packages/ui-tokens) y modo oscuro
│   │   │   └── web3/
│   │   │       ├── chains.ts                                    # Redes permitidas
│   │   │       └── viem-client.ts                               # Cliente viem compartido (Sepolia: EIP-6963, firma SIWE, sendTransaction y lectura)
│   │   ├── features/                                            # Una carpeta por funcionalidad (corte vertical)
│   │   │   ├── assistant/                                       # Funcionalidad: Tutor IA (chat)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── assistant.facade.ts                      # [CREAR, LISTAR, VER DETALLE] Casos de uso: enviar mensaje y recibir tokens por SSE
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── assistant.ts                         # Tipos y esquemas de Funcionalidad: Tutor IA (chat)
│   │   │   │   │   └── assistant.repository.port.ts             # [CREAR, LISTAR, VER DETALLE] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── assistant.http-repository.ts             # [CREAR, LISTAR, VER DETALLE] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── confirm-dialog.component.ts          # confirmación de borrado (conversación o mensaje) SIN `window.confirm`
│   │   │   │   │   │   ├── conversation-chat.component.ts       # Chat con respuesta en streaming
│   │   │   │   │   │   ├── conversation-list.component.ts       # «Mis conversaciones» del Tutor IA — abrir, renombrar en línea y pedir borrado (el diálogo lo pinta la página)
│   │   │   │   │   │   ├── language-usage-meter.component.ts    # indicador «Uso del idioma: 45 % / meta 60 %» con barra y marca de la meta del nivel
│   │   │   │   │   │   └── tutor-quick-chat.component.ts        # pestaña «Tutor» del chatbot flotante — misma conversación que /tutor en pequeño: idioma, nivel, chat, enviar y eliminar …
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       └── assistant.page.ts                    # Chat conversacional con el tutor
│   │   │   │   └── assistant.routes.ts                          # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── certificates/                                    # Funcionalidad: Certificados PDF
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── certificates.facade.ts                   # [CREAR, LISTAR, VER DETALLE] Casos de uso: solicitar, descargar y verificar
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── certificates.ts                      # Tipos y esquemas de Funcionalidad: Certificados PDF
│   │   │   │   │   └── certificates.repository.port.ts          # [CREAR, LISTAR, VER DETALLE] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── certificates.http-repository.ts          # [CREAR, LISTAR, VER DETALLE] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── certificate-verify.page.ts           # Verificación pública por código
│   │   │   │   │       └── certificates.page.ts                 # Lista y solicitud de certificados
│   │   │   │   └── certificates.routes.ts                       # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── dialogues/                                       # Funcionalidad: Diálogos y conversación con el avatar
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── dialogue-agent.facade.ts                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: conversación con el agente (SSE)
│   │   │   │   │   └── dialogues.facade.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: temas, biblioteca y subida
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── dialogues.ts                         # Tipos y esquemas de Funcionalidad: Diálogos y conversación con el avatar
│   │   │   │   │   └── dialogues.repository.port.ts             # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── dialogues.http-repository.ts             # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── dialogue-form.component.ts           # [CREAR, VER DETALLE, EDITAR] Turnos por hablante con vista previa de IPA y traducción
│   │   │   │   │   │   ├── dialogue-topic-picker.component.ts   # Elegir tema, idioma y nivel
│   │   │   │   │   │   ├── level-badge.component.ts             # Nivel A1–C2 «estimado» o «confirmado»
│   │   │   │   │   │   ├── level-confirm.component.ts           # Nivel estimado + indicadores: el docente confirma o cambia
│   │   │   │   │   │   ├── role-selector.component.ts           # Practicar como hablante A o B
│   │   │   │   │   │   ├── speaker-avatars.component.ts         # Un avatar por hablante
│   │   │   │   │   │   └── topic-card.component.ts              # Tema: presentarse, hobbies, familia, comida, viajes, cultura…
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── avatar-conversation.page.ts          # Conversación con el avatar por tema
│   │   │   │   │       ├── dialogue-hub.page.ts                 # Temas de conversación por idioma y nivel
│   │   │   │   │       ├── dialogue-library.page.ts             # Biblioteca de diálogos guionados
│   │   │   │   │       ├── dialogue-player.page.ts              # Practicar un diálogo como hablante A o B
│   │   │   │   │       └── dialogue-upload.page.ts              # Subir un diálogo y confirmar su nivel
│   │   │   │   └── dialogues.routes.ts                          # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── feedback/                                        # Funcionalidad: Plan de estudio y recomendaciones
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── feedback.facade.ts                       # [LISTAR, VER DETALLE] Casos de uso: plan, recomendaciones y progreso
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── feedback.ts                          # Tipos y esquemas de Funcionalidad: Plan de estudio y recomendaciones
│   │   │   │   │   └── feedback.repository.port.ts              # [LISTAR, VER DETALLE] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── feedback.http-repository.ts              # [LISTAR, VER DETALLE] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── recommendations.page.ts              # Recomendaciones según debilidades
│   │   │   │   │       └── study-plan.page.ts                   # Plan de estudio personalizado
│   │   │   │   └── feedback.routes.ts                           # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── forums/                                          # Funcionalidad: Foros por lección
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── forums.facade.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: hilos, respuestas y moderación
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── forums.ts                            # Tipos y esquemas de Funcionalidad: Foros por lección
│   │   │   │   │   └── forums.repository.port.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── forums.http-repository.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── forum-post-form.component.ts         # [CREAR, VER DETALLE, EDITAR] Responder a un hilo
│   │   │   │   │   │   ├── forum-thread-form.component.ts       # [CREAR, VER DETALLE, EDITAR] Crear hilo (Signal Forms + Zod)
│   │   │   │   │   │   └── post-list.component.ts               # [LISTAR] Lista de respuestas
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       └── threads.page.ts                      # Hilos de una lección y sus respuestas
│   │   │   │   └── forums.routes.ts                             # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── games/                                           # Funcionalidad: Juegos y actividades (vocabulario, fluidez, comprensión, recuperación)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── game-agent.facade.ts                     # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: turnos con el agente de juegos (SSE)
│   │   │   │   │   ├── games.facade.ts                          # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: sesiones y rondas de los juegos
│   │   │   │   │   └── speech.facade.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: transcripción y métricas de voz
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   ├── game-type.ts                         # Catálogo de tipos de juego
│   │   │   │   │   │   └── games.ts                             # Sesión, ronda y resultado
│   │   │   │   │   └── games.repository.port.ts                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── games.http-repository.ts                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── agent-game.component.ts              # Plantilla de los seis juegos contra el agente (estímulo + conversación)
│   │   │   │   │   │   ├── answer-timer.component.ts            # Mide el tiempo hasta responder
│   │   │   │   │   │   ├── audio-player.component.ts            # Audio con SpeechSynthesis (voz en-GB / en-US)
│   │   │   │   │   │   ├── bingo-board.component.ts             # Tablero: escuchar la palabra y localizarla
│   │   │   │   │   │   ├── category-bucket.component.ts         # Clasificar por categoría con CDK DragDrop
│   │   │   │   │   │   ├── chat-turns.component.ts              # Turnos del usuario y del agente (aria-live)
│   │   │   │   │   │   ├── conversation-panel.component.ts      # Conversación con objetivos visibles
│   │   │   │   │   │   ├── countdown-ring.component.ts          # Cuenta regresiva que no depende del color
│   │   │   │   │   │   ├── flashcard.component.ts               # Tarjeta: se pide recordar antes de mostrar la respuesta
│   │   │   │   │   │   ├── game-card.component.ts               # Tarjeta del juego con la habilidad que entrena
│   │   │   │   │   │   ├── game-shell.component.ts              # Armazón común: preparar (idioma, nivel, dificultad) → jugar → terminar/abandonar → resumen
│   │   │   │   │   │   ├── gap-fill.component.ts                # Completar las palabras que faltan
│   │   │   │   │   │   ├── listening-game.component.ts          # Shadowing, dictado parcial, escucha y reformula y pregunta rápida (Strategy por modo)
│   │   │   │   │   │   ├── memory-board.component.ts            # Tablero de parejas (palabra–imagen / traducción / definición)
│   │   │   │   │   │   ├── metric-card.component.ts             # Métrica: tiempo, continuidad, palabras y vocabulario reutilizado
│   │   │   │   │   │   ├── oral-round-result.component.ts       # Lo que entendió faster-whisper + métricas de la ronda oral
│   │   │   │   │   │   ├── prompt-card.component.ts             # Estímulo: imagen, palabra, audio o situación
│   │   │   │   │   │   ├── scenario-card.component.ts           # Escenario: restaurante, entrevista, aeropuerto, médico, hotel, reunión
│   │   │   │   │   │   ├── trend-chart.component.ts             # Gráfica de tendencia en SVG propio (sin librería nueva)
│   │   │   │   │   │   └── turn-timer.component.ts              # Cuenta regresiva accesible por turno
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── bingo.page.ts                        # Vocabulario: bingo de palabras
│   │   │   │   │       ├── chained-story.page.ts                # Fluidez: historia encadenada
│   │   │   │   │       ├── describe-guess.page.ts               # Fluidez: describe y adivina
│   │   │   │   │       ├── flashcards.page.ts                   # Vocabulario: tarjetas de memoria
│   │   │   │   │       ├── fluency-dashboard.page.ts            # Panel de métricas de fluidez
│   │   │   │   │       ├── forbidden-word.page.ts               # Vocabulario: palabra prohibida
│   │   │   │   │       ├── game-result.page.ts                  # Resultado de una sesión
│   │   │   │   │       ├── games-hub.page.ts                    # Hub: catálogo de juegos por habilidad
│   │   │   │   │       ├── hangman.page.ts                      # /juegos/ahorcado — adivinar cada palabra del mazo letra a letra con su traducción (y emoji) como pista; 6 fallos = palab…
│   │   │   │   │       ├── listen-reformulate.page.ts           # Comprensión: escucha y reformula
│   │   │   │   │       ├── memory.page.ts                       # Vocabulario: parejas
│   │   │   │   │       ├── partial-dictation.page.ts            # Comprensión: dictado parcial
│   │   │   │   │       ├── quick-debate.page.ts                 # Fluidez: debate rápido
│   │   │   │   │       ├── quick-qa.page.ts                     # Comprensión: pregunta-respuesta rápida
│   │   │   │   │       ├── quick-sort.page.ts                   # Vocabulario: clasificación rápida
│   │   │   │   │       ├── random-topic.page.ts                 # Fluidez: tema al azar
│   │   │   │   │       ├── recovery-drills.page.ts              # Recuperación rápida de vocabulario
│   │   │   │   │       ├── role-play.page.ts                    # Fluidez: role-play
│   │   │   │   │       ├── scenario-list.page.ts                # Fluidez: escenarios de role-play
│   │   │   │   │       ├── shadowing.page.ts                    # Comprensión: shadowing
│   │   │   │   │       ├── speed-speaking.page.ts               # Fluidez: hablar contra reloj
│   │   │   │   │       ├── taboo.page.ts                        # Fluidez: tabú
│   │   │   │   │       └── twenty-questions.page.ts             # Fluidez: 20 preguntas
│   │   │   │   └── games.routes.ts                              # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── grammar/                                         # Funcionalidad: Gramática (fichas con uso, fórmula, ejemplos, IPA y traducción)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── grammar.facade.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: fichas, secciones y ejemplos
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── grammar.ts                           # Tipos y esquemas de Funcionalidad: Gramática (fichas con uso, fórmula, ejemplos, IPA y traducción)
│   │   │   │   │   └── grammar.repository.port.ts               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── grammar.http-repository.ts               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── example-line.component.ts            # Ejemplo con IPA UK/US, traducción y sonido (texto con diccionario)
│   │   │   │   │   │   ├── grammar-card.component.ts            # Ficha de un tema con sus secciones
│   │   │   │   │   │   ├── grammar-example-form.component.ts    # [CREAR, VER DETALLE, EDITAR] Editar un ejemplo con vista previa de IPA y traducción
│   │   │   │   │   │   ├── grammar-section-form.component.ts    # [CREAR, VER DETALLE, EDITAR] Editar una sección
│   │   │   │   │   │   ├── grammar-section.component.ts         # Sección con icono y color: uso, fórmula, negativa, interrogativa, nota
│   │   │   │   │   │   └── translation-toggle.component.ts      # Mostrar u ocultar la traducción (visible por defecto)
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── grammar-editor.page.ts               # Editor manual o con borrador de IA (DOCENTE)
│   │   │   │   │       ├── grammar-list.page.ts                 # [LISTAR] Lista de temas de gramática
│   │   │   │   │       └── grammar-topic.page.ts                # Ficha de un tema
│   │   │   │   └── grammar.routes.ts                            # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── help/                                            # Funcionalidad: Centro de ayuda (FAQ, manual y Agente Guía)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── guide.facade.ts                          # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: preguntar al Agente Guía (SSE)
│   │   │   │   │   └── help.facade.ts                           # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: FAQ, manual y reindexado
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── help.ts                              # Tipos y esquemas de Funcionalidad: Centro de ayuda (FAQ, manual y Agente Guía)
│   │   │   │   │   └── help.repository.port.ts                  # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── help.http-repository.ts                  # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── faq-form.component.ts                # [CREAR, VER DETALLE, EDITAR] Editor de preguntas (ADMIN, Signal Forms + Zod)
│   │   │   │   │   │   ├── faq-list.component.ts                # [LISTAR] Acordeón accesible con búsqueda
│   │   │   │   │   │   ├── guide-chat.component.ts              # Chat accesible del Agente Guía (foco atrapado, aria-live)
│   │   │   │   │   │   └── guide-widget.element.ts              # Angular Element <aula-guia-widget> para el layout de Next.js
│   │   │   │   │   ├── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │   │   ├── faq.page.ts                          # Preguntas frecuentes con búsqueda
│   │   │   │   │   │   ├── manual-article.page.ts               # Artículo del manual (Markdown sanitizado)
│   │   │   │   │   │   └── manual.page.ts                       # Manual de usuario: tabla de contenido por rol
│   │   │   │   │   └── pipes/                                   # Pipes de la funcionalidad
│   │   │   │   │       └── markdown.pipe.ts                     # Markdown → HTML (marked + DOMPurify)
│   │   │   │   └── help.routes.ts                               # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── music/                                           # Funcionalidad: Música y canciones (colecciones, karaoke con avatar, prácticas)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── music.facade.ts                          # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: colecciones, canciones y subida
│   │   │   │   │   └── song-player.facade.ts                    # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: tiempo del audio y línea actual
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── music.ts                             # Tipos y esquemas de Funcionalidad: Música y canciones (colecciones, karaoke con avatar, prácticas)
│   │   │   │   │   └── music.repository.port.ts                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   ├── lyrics-import.service.ts                 # «Importar la letra desde un enlace» → primero NestJS POST /music/lyrics/from-url (descarga como navegador y localiza la …
│   │   │   │   │   └── music.http-repository.ts                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── audio-controls.component.ts          # Reproducir, pausar, repetir línea y velocidad (0,75x / 1x)
│   │   │   │   │   │   ├── audio-uploader.component.ts          # Subir el audio con límite de tamaño
│   │   │   │   │   │   ├── collection-card.component.ts         # Tarjeta de colección
│   │   │   │   │   │   ├── lyrics-editor.component.ts           # Pegar la letra y revisar IPA y traducción por línea
│   │   │   │   │   │   ├── practice-launcher.component.ts       # Elegir: completar letra, ordenar versos o marcar palabras
│   │   │   │   │   │   ├── practice-link.component.ts           # Acceso a las prácticas de la canción
│   │   │   │   │   │   ├── song-card.component.ts               # Canción con idioma, nivel y licencia visible
│   │   │   │   │   │   └── sync-editor.component.ts             # [EDITAR] Tocar al ritmo para marcar el inicio de cada línea
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── collection-detail.page.ts            # Detalle de una colección
│   │   │   │   │       ├── music-hub.page.ts                    # Colecciones por idioma y nivel
│   │   │   │   │       ├── song-player.page.ts                  # Reproductor: avatar canta + texto sincronizado
│   │   │   │   │       └── song-upload.page.ts                  # Subir canción: licencia, letra y sincronización
│   │   │   │   └── music.routes.ts                              # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── notifications/                                   # Funcionalidad: Notificaciones en tiempo real
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── notifications.facade.ts                  # [LISTAR, VER DETALLE, EDITAR] Casos de uso: listar, marcar leídas y contador
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── notifications.ts                     # Tipos y esquemas de Funcionalidad: Notificaciones en tiempo real
│   │   │   │   │   └── notifications.repository.port.ts         # [LISTAR, VER DETALLE, EDITAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   ├── notifications.http-repository.ts         # [LISTAR, VER DETALLE, EDITAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   │   └── notifications.stream.ts                  # SSE con reconexión (Last-Event-ID)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── notification-bell.element.ts         # Angular Element <aula-campana>: contador en el encabezado de Next.js
│   │   │   │   │   │   └── notifications-menu.component.ts      # Campana del topbar con panel (igual que la de Next.js); se proyecta en <aula-portal-topbar>
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       └── notifications.page.ts                # Bandeja de notificaciones
│   │   │   │   ├── notifications.providers.ts                   # Puerto → adaptador + fachada (los comparten la ruta y <aula-campana>)
│   │   │   │   └── notifications.routes.ts                      # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── own-llm/                                         # Funcionalidad: LLM propio (corrector de redacciones, RF-144)
│   │   │   │   ├── application/
│   │   │   │   │   └── own-llm.facade.ts                        # [CREAR, LISTAR] Casos de uso: enviar la redacción y mostrar el resultado (signals)
│   │   │   │   ├── domain/
│   │   │   │   │   ├── models/
│   │   │   │   │   │   └── own-llm.ts                           # redacción, errores marcados y corrección
│   │   │   │   │   └── own-llm.repository.port.ts               # [CREAR, LISTAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/
│   │   │   │   │   └── own-llm.http-repository.ts               # [CREAR, LISTAR] Adaptador: HttpClient hacia /api/ai/own-llm/* (único lugar con HTTP)
│   │   │   │   ├── presentation/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── correction-errors.component.ts       # lista de errores del corrector único → categoría, «original → sugerencia» y explicación en español
│   │   │   │   │   │   └── marked-text.component.ts             # Texto con errores marcados: subrayado + icono + texto, navegable con teclado
│   │   │   │   │   └── pages/
│   │   │   │   │       └── writing-corrector.page.ts            # Corrector de redacciones: editor, nivel y resultado
│   │   │   │   └── own-llm.routes.ts                            # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── payments/                                        # Funcionalidad: Checkout y pago (tarjeta y criptomonedas)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── order.facade.ts                          # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: crear orden, pagar, consultar estado
│   │   │   │   │   ├── payment-status.resource.ts               # resource() del estado del pago con polling
│   │   │   │   │   └── payments.facade.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: listar pagos y solicitar reembolso
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── payments.ts                          # Tipos y esquemas de Funcionalidad: Checkout y pago (tarjeta y criptomonedas)
│   │   │   │   │   └── payments.repository.port.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── payments.http-repository.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── card-payment.component.ts            # Pago con tarjeta: Stripe.js aloja el formulario
│   │   │   │   │   │   ├── order-summary.component.ts           # Resumen de la orden (ítems y total)
│   │   │   │   │   │   └── refund-dialog.component.ts           # Diálogo de reembolso (rol ADMIN)
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── order-checkout.page.ts               # Resumen del carrito y pago con tarjeta
│   │   │   │   │       └── payments.page.ts                     # Historial de pagos del usuario
│   │   │   │   └── payments.routes.ts                           # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── polyglot/                                        # Funcionalidad: Poliglota (comparador de idiomas por tema)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── polyglot.facade.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: tema, idiomas, orden y vistas guardadas
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── polyglot.ts                          # Tipos y esquemas de Funcionalidad: Poliglota (comparador de idiomas por tema)
│   │   │   │   │   ├── language-order.ts                        # Función pura: orden por defecto (español al final) y reordenamiento
│   │   │   │   │   └── polyglot.repository.port.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── polyglot.http-repository.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── language-picker.component.ts         # Elegir idiomas y su orden (CDK DragDrop o botones subir/bajar)
│   │   │   │   │   │   ├── polyglot-cards.component.ts          # Vista de tarjetas en pantallas estrechas
│   │   │   │   │   │   ├── polyglot-cell.component.ts           # Término con su IPA y su botón de sonido
│   │   │   │   │   │   ├── polyglot-concept-form.component.ts   # [CREAR, VER DETALLE, EDITAR] Emoji o imagen y un término por idioma con su IPA
│   │   │   │   │   │   ├── polyglot-table.component.ts          # [LISTAR] Tabla: img, inglés, alemán, francés, portugués, ruso, chino y español
│   │   │   │   │   │   └── polyglot-topic-picker.component.ts   # Elegir el tema (familia, animales, comida, viajes, cultura…)
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── polyglot-builder.page.ts             # Editor de temas y conceptos (DOCENTE / ADMIN)
│   │   │   │   │       └── polyglot.page.ts                     # Tabla comparativa: elegir tema e idiomas
│   │   │   │   └── polyglot.routes.ts                           # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── practice/                                        # Funcionalidad: Práctica interactiva y retroalimentación
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── activity-builder.facade.ts               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: crear y guardar actividades
│   │   │   │   │   └── practice.facade.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: intentos y corrección
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── practice.ts                          # Tipos y esquemas de Funcionalidad: Práctica interactiva y retroalimentación
│   │   │   │   │   └── practice.repository.port.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   ├── content-catalog.service.ts               # opciones para VINCULAR contenido a una actividad (vocabulario de Recursos, juegos, canciones, diálogos, fichas de gramát…
│   │   │   │   │   └── practice.http-repository.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── activity-contents.component.ts       # contenidos que forman una actividad (p. ej. «Los alimentos» → vocabulario, un juego, una canción, un diálogo)
│   │   │   │   │   │   ├── correction-diff.component.ts         # Lo escrito tachado y la corrección
│   │   │   │   │   │   ├── drag-order.component.ts              # Ordenar arrastrando (CDK DragDrop) + alternativa por teclado
│   │   │   │   │   │   ├── error-badge.component.ts             # Tipo de error con icono y texto
│   │   │   │   │   │   ├── feedback-panel.component.ts          # Panel bajo el ejercicio (role="status", aria-live)
│   │   │   │   │   │   ├── fill-blank.component.ts              # Completar huecos
│   │   │   │   │   │   ├── mark-errors.component.ts             # [EDITAR] Marcador: cada palabra es un botón con aria-pressed
│   │   │   │   │   │   ├── match-pairs.component.ts             # Emparejar arrastrando
│   │   │   │   │   │   ├── multiple-choice.component.ts         # Opción múltiple
│   │   │   │   │   │   ├── practice-item-form.component.ts      # [CREAR, VER DETALLE, EDITAR] Editor de ítem: tipo, habilidad, respuestas, explicación y consejo
│   │   │   │   │   │   └── tip-card.component.ts                # Consejo del ítem
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── activity-builder.page.ts             # Constructor de actividades (DOCENTE)
│   │   │   │   │       ├── practice-list.page.ts                # Lista de actividades
│   │   │   │   │       └── practice-player.page.ts              # Reproductor: resuelve y corrige un ejercicio
│   │   │   │   └── practice.routes.ts                           # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── reading/
│   │   │   │   ├── application/
│   │   │   │   │   ├── books.facade.ts                          # catálogo, lectura por páginas, traducción e IPA bajo demanda y progreso
│   │   │   │   │   ├── read-aloud.player.ts                     # lectura en voz alta FRASE A FRASE con la palabra activa resaltada — reproducir/pausar, velocidad 0,75x/1x, repetir la fr…
│   │   │   │   │   └── reading.facade.ts                        # casos de uso de la lista y del lector (cargar, guardar el marcador sin bloquear la lectura, empezar de nuevo, enlaces de…
│   │   │   │   ├── domain/
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── book.ts                              # contrato de /books (NestJS) validado con Zod + funciones puras del lector
│   │   │   │   │   │   ├── dictation.ts                         # compara la frase dictada con lo que escribió el alumno, palabra por palabra
│   │   │   │   │   │   └── reading.ts                           # contrato de /api/reading/texts/* de NestJS + funciones PURAS del lector (palabras con su posición, palabra activa por ca…
│   │   │   │   │   ├── books.repository.port.ts                 # la fachada no conoce HTTP
│   │   │   │   │   └── reading.repository.port.ts               # lista, lector, marcador y enlaces de descarga — sin que las pantallas conozcan HTTP
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── books.http-repository.ts                 # BooksRepository sobre NestJS /books (respuestas validadas con Zod)
│   │   │   │   │   └── reading.http-repository.ts               # HttpClient hacia /api/reading/texts/* (BFF de Next.js → NestJS)
│   │   │   │   ├── presentation/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── reading-sentence.component.ts        # pulsar una palabra abre su ficha (la coloca la página con `el`) · las palabras del banco se resaltan: punteado = aprendi…
│   │   │   │   │   │   ├── reading-translation-pane.component.ts  # columna DERECHA del lector — la traducción al español frase a frase, con los mismos párrafos que el original
│   │   │   │   │   │   └── reading-views.component.ts           # pills de las vistas de Lectura — Lecturas · Dictado · Libros clásicos (mismo átomo que las secciones de Actividades)
│   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── book-reader.page.ts                  # /lectura/libros/:id — original y traducción al español en columnas
│   │   │   │   │   │   ├── books-list.page.ts                   # /lectura/libros — buscar libros de dominio público por título o autor en los 7 idiomas
│   │   │   │   │   │   ├── dictation.page.ts                    # /lectura/dictado — se elige una lectura publicada, se ESCUCHA cada frase (voz del navegador) y se escribe
│   │   │   │   │   │   ├── reading-list.page.ts                 # sin tarjetas de libros abajo (están en /lectura/libros, pill «Libros clásicos»)
│   │   │   │   │   │   └── reading-reader.page.ts               # /lectura/:id — el texto original con IPA y traducción a elección, lectura en voz alta frase a frase con la palabra activ…
│   │   │   │   │   └── scroll-into-box.ts                       # desplaza SOLO la columna con scroll propio (`[data-reading-scroll]`) para que la frase quede a la vista,
│   │   │   │   └── reading.routes.ts                            # /lectura (lista con filtros) y /lectura/:id (lector) — lazy y con sesión; crear/editar viven en Gestión de Next.js
│   │   │   ├── reports/                                         # Funcionalidad: Exportación de reportes (PDF / Excel)
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   └── reports.facade.ts                        # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Casos de uso: solicitar y descargar exportaciones
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── reports.ts                           # Tipos y esquemas de Funcionalidad: Exportación de reportes (PDF / Excel) · downloadUrl(): con S3/R2 el BFF responde 302 a una URL firmada y el archivo baja directo del bucket (Sprint 6.7)
│   │   │   │   │   └── reports.repository.port.ts               # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── reports.http-repository.ts               # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   └── report-export-button.element.ts      # Angular Element <aula-exportar>: botón en los reportes de Next.js
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       └── report-exports.page.ts               # Exportaciones solicitadas y su estado
│   │   │   │   ├── reports.providers.ts                         # Puerto → adaptador + fachada (los comparten la ruta y <aula-exportar>)
│   │   │   │   └── reports.routes.ts                            # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   ├── vocabulary/                                      # Funcionalidad: Traducción, IPA UK/US y banco de vocabulario
│   │   │   │   ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │   │   │   ├── ipa-lookup.cache.ts                      # consulta de IPA/traducción COMPARTIDA por todos los <aula-ipa-text> de la página
│   │   │   │   │   ├── vocabulary-entry.facade.ts               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: CRUD del banco de vocabulario
│   │   │   │   │   └── vocabulary.facade.ts                     # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: traducir y obtener IPA
│   │   │   │   ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │   │   │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │   │   │   │   └── vocabulary.ts                        # Tipos y esquemas de Funcionalidad: Traducción, IPA UK/US y banco de vocabulario
│   │   │   │   │   └── vocabulary.repository.port.ts            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │   │   ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │   │   │   └── vocabulary.http-repository.ts            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │   │   ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │   │   │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │   │   │   │   ├── ipa-text.element.ts                  # Angular Element <aula-ipa-text>: texto con IPA por palabra
│   │   │   │   │   │   ├── lookup-input.component.ts            # [VER DETALLE] Escribir un término o una frase
│   │   │   │   │   │   ├── say.component.ts                     # una palabra o frase del idioma estudiado DENTRO de una actividad (práctica, juegos) → botón de sonido + IPA + traducción…
│   │   │   │   │   │   ├── translation-card.component.ts        # Traducción y alternativas
│   │   │   │   │   │   ├── vocabulary-entry-form.component.ts   # [CREAR, VER DETALLE, EDITAR] Alta de vocabulario (Signal Forms + Zod)
│   │   │   │   │   │   └── vocabulary-entry-table.component.ts  # [LISTAR] Tabla con IPA UK/US y estado «automático» o «revisado»
│   │   │   │   │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │   │   │       ├── language-lookup.page.ts              # Traductor con IPA
│   │   │   │   │       └── vocabulary-entry.page.ts             # Banco de vocabulario (revisión del docente)
│   │   │   │   ├── ipa-text.providers.ts                        # lo que necesita <aula-ipa-text-element> (IPA + traducción + sonido de cualquier texto) DENTRO de la app Angular — puerto…
│   │   │   │   └── vocabulary.routes.ts                         # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   │   └── web3/                                            # Funcionalidad: Billetera Web3
│   │   │       ├── application/                                 # Capa Aplicación — fachadas (casos de uso) y estado con signals
│   │   │       │   ├── crypto-payment.facade.ts                 # [CREAR, LISTAR, VER DETALLE] Casos de uso: pago cripto y espera de confirmaciones
│   │   │       │   └── wallet.facade.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Casos de uso: nonce, firma SIWE con viem y vinculación
│   │   │       ├── domain/                                      # Capa Dominio — sin Angular HTTP ni router (solo Zod y funciones puras)
│   │   │       │   ├── models/                                  # Tipos y esquemas Zod (contrato compartido con packages/shared-schemas)
│   │   │       │   │   └── wallet.ts                            # Tipos y esquemas de Funcionalidad: Billetera Web3
│   │   │       │   └── wallet.repository.port.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Puerto: contrato del repositorio (clase abstracta + InjectionToken)
│   │   │       ├── infrastructure/                              # Capa Infraestructura — HTTP, SSE y mapeadores
│   │   │       │   ├── crypto-payment.stream.ts                 # SSE: confirmaciones en vivo del pago cripto
│   │   │       │   └── wallet.http-repository.ts                # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Adaptador: implementa el puerto con HttpClient hacia /api/* (único lugar con HTTP)
│   │   │       ├── presentation/                                # Capa Presentación — pages (contenedor) + components (presentacional)
│   │   │       │   ├── components/                              # Componentes presentacionales (input() / output(), sin servicios)
│   │   │       │   │   ├── connect-wallet.component.ts          # Conexión con descubrimiento EIP-6963
│   │   │       │   │   └── crypto-payment.component.ts          # Pago on-chain: transferencia de ETH de prueba con sendTransaction de viem a la dirección de la plataforma
│   │   │       │   └── pages/                                   # Contenedores (inyectan la fachada, sin HTTP)
│   │   │       │       ├── crypto-payment.page.ts               # Pago con criptomonedas (inicia y sigue confirmaciones)
│   │   │       │       └── wallet.page.ts                       # Conectar billetera y ver su estado
│   │   │       └── web3.routes.ts                               # Rutas lazy + providers (puerto → repositorio HTTP)
│   │   ├── shared/                                              # Reutilizable (puede usar core; NUNCA importa features)
│   │   │   ├── directives/
│   │   │   │   └── word-lookup.directive.ts                     # Convierte un texto en palabras pulsables (Intl.Segmenter) con navegación por teclado
│   │   │   ├── pipes/                                           # Pipes
│   │   │   │   └── .gitkeep                                     # Se llena cuando 2+ funcionalidades necesiten el mismo pipe
│   │   │   ├── ui/                                              # Atomic Design — sin lógica de negocio
│   │   │   │   ├── atoms/                                       # Átomos: no se dividen y no reciben datos del dominio
│   │   │   │   │   ├── avatar-svg/
│   │   │   │   │   │   ├── avatar-svg.component.ts              # Personaje en SVG con formas de boca y parpadeo
│   │   │   │   │   │   └── avatar-svg.stories.ts                # [Sprint 11.2] Storybook: avatar-svg (formas de boca y parpadeo) con axe
│   │   │   │   │   ├── back-link/
│   │   │   │   │   │   ├── back-link.component.ts               # enlace «volver» ÚNICO del remoto — flecha + texto, con aspecto de ENLACE (no de botón); espejo de <BackLink> de Next.js
│   │   │   │   │   │   └── back-link.stories.ts                 # enlace «volver» (flecha + texto) sobre el <a> nativo
│   │   │   │   │   ├── badge/
│   │   │   │   │   │   ├── badge.component.ts                   # Etiqueta de estado (texto + icono, no solo color)
│   │   │   │   │   │   └── badge.stories.ts                     # [Sprint 11.2] Storybook: tonos brand/info/warning/danger/muted
│   │   │   │   │   ├── button/
│   │   │   │   │   │   ├── button.component.ts                  # Botón: variantes y estados (disabled / loading)
│   │   │   │   │   │   └── button.stories.ts                    # [Sprint 11.2] Storybook: variantes, tamaños, loading y disabled
│   │   │   │   │   ├── icon/
│   │   │   │   │   │   ├── icon.component.ts                    # Icono SVG con etiqueta accesible
│   │   │   │   │   │   └── icon.stories.ts                      # [Sprint 11.2] Storybook: icon (con y sin etiqueta accesible) con axe
│   │   │   │   │   ├── ipa-label/
│   │   │   │   │   │   ├── ipa-label.component.ts               # IPA con lang="xx-fonipa"
│   │   │   │   │   │   └── ipa-label.stories.ts                 # [Sprint 11.2] Storybook: ipa-label (IPA UK y US) con axe
│   │   │   │   │   ├── level-tint/
│   │   │   │   │   │   ├── level-tint.directive.ts              # `[aulaLevel]="'B1'"` publica `--lvl` (acento) y `--lvl-deep` (fondo oscuro) del nivel MCER en el elemento → los hijos se…
│   │   │   │   │   │   └── level-tint.stories.ts                # tinte por nivel MCER (A1–C2) vía variables CSS `--lvl` / `--lvl-deep`
│   │   │   │   │   ├── spinner/
│   │   │   │   │   │   ├── busy-overlay.component.ts            # capa sobre la pantalla con el MISMO indicador de carga (aula-spinner) mientras se crea, edita o elimina algo
│   │   │   │   │   │   ├── spinner.component.ts                 # Indicador de carga con role="status"
│   │   │   │   │   │   └── spinner.stories.ts                   # [Sprint 11.2] Storybook: spinner (tamaños y role=status) con axe
│   │   │   │   │   └── text-input/
│   │   │   │   │       ├── text-input.component.ts              # Campo de texto compatible con Signal Forms
│   │   │   │   │       └── text-input.stories.ts                # [Sprint 11.2] Storybook: text-input (default · inválido · deshabilitado) con axe
│   │   │   │   ├── molecules/                                   # Moléculas: juntan átomos con una sola función
│   │   │   │   │   ├── accent-switch/
│   │   │   │   │   │   ├── accent-switch.component.ts           # Interruptor UK/US (role="switch") — usado por diccionario, poliglota y gramática
│   │   │   │   │   │   └── accent-switch.stories.ts             # [Sprint 11.2] Storybook: accent-switch (UK · US · teclado) con axe
│   │   │   │   │   ├── dropdown/
│   │   │   │   │   │   ├── dropdown.component.ts                # Botón + panel flotante del topbar (Escape, clic fuera, aria-expanded)
│   │   │   │   │   │   └── dropdown.stories.ts                  # [Sprint 11.2] Storybook: dropdown (abierto · cerrado · Escape) con axe
│   │   │   │   │   ├── filter-panel/
│   │   │   │   │   │   ├── filter-panel.component.ts            # panel de filtros de las secciones de Actividades del estudiante con el MISMO diseño que Gestión (Next.js <FilterPanel>)
│   │   │   │   │   │   └── filter-panel.stories.ts              # panel común de filtros (Buscar · Nivel · filtros propios · Filtrar · Limpiar + idiomas debajo)
│   │   │   │   │   ├── form-field/
│   │   │   │   │   │   ├── form-field.component.ts              # Etiqueta + campo + mensaje de error asociado (aria-describedby)
│   │   │   │   │   │   └── form-field.stories.ts                # [Sprint 11.2] Storybook: form-field (con error y ayuda) con axe
│   │   │   │   │   ├── language-chips/
│   │   │   │   │   │   ├── language-chips.component.ts          # pestañas de idioma («✦ Todos» + «EN Inglés», «FR Francés»…) — la MISMA clasificación del catálogo de Cursos de Next.js (…
│   │   │   │   │   │   └── language-chips.stories.ts            # filtro de idioma con chips (radiogroup) a partir de LANGUAGES compartido
│   │   │   │   │   ├── mode-switch/
│   │   │   │   │   │   ├── mode-switch.component.ts             # control segmentado «¿Cómo lo quieres hacer?» (Automático con IA / Manual / Desde una URL…)
│   │   │   │   │   │   └── mode-switch.stories.ts               # selector segmentado (fieldset + radios) con ayuda por opción
│   │   │   │   │   ├── pill-nav/
│   │   │   │   │   │   ├── pill-nav.component.ts                # navegación en pills (chips) entre pantallas hermanas — secciones de Actividades y vistas de una sección (Diálogos: temas…
│   │   │   │   │   │   └── pill-nav.stories.ts                  # navegación en píldoras con RouterLinkActive
│   │   │   │   │   ├── pronunciation-button/
│   │   │   │   │   │   ├── pronunciation-button.component.ts    # Botón de sonido con la voz del navegador del idioma
│   │   │   │   │   │   └── pronunciation-button.stories.ts      # [Sprint 11.2] Storybook: pronunciation-button (reposo · reproduciendo · sin voz) con axe
│   │   │   │   │   ├── text-import/
│   │   │   │   │   │   ├── text-import.component.ts             # «Importar desde archivo o enlace» — PDF, Word, texto o imagen (OCR) y URL → emite el texto leído para rellenar un formul…
│   │   │   │   │   │   └── text-import.stories.ts               # importar texto desde archivo (PDF/Word/imagen) o enlace
│   │   │   │   │   ├── title-gloss/
│   │   │   │   │   │   ├── title-gloss.component.ts             # bajo el título de una actividad o recurso → idioma · /IPA/ · 🔊 · traducción al español
│   │   │   │   │   │   └── title-gloss.stories.ts               # título en el idioma original con su IPA y traducción debajo
│   │   │   │   │   ├── transcript-line/
│   │   │   │   │   │   ├── transcript-line.component.ts         # Línea con IPA y traducción; la actual con aria-current
│   │   │   │   │   │   └── transcript-line.stories.ts           # [Sprint 11.2] Storybook: transcript-line (línea actual y normal) con axe
│   │   │   │   │   └── word-token/
│   │   │   │   │       ├── word-token.component.ts              # Palabra pulsable dentro de un texto (resaltada si se está aprendiendo)
│   │   │   │   │       └── word-token.stories.ts                # [Sprint 11.2] Storybook: word-token (normal · aprendiendo · enfocada) con axe
│   │   │   │   ├── mode-switch/
│   │   │   │   │   ├── mode-switch.component.ts                 # Selector de modo (automático / manual / URL / IA) · 2026-10-19
│   │   │   │   │   └── mode-switch.stories.ts                   # [Sprint 11.2] Storybook: mode-switch (automático · manual · URL · IA) con axe
│   │   │   │   ├── organisms/                                   # Organismos: secciones autónomas con datos y comportamiento propios
│   │   │   │   │   ├── ai-draft-dialog/
│   │   │   │   │   │   ├── ai-draft-dialog.component.ts         # Pide un borrador a la IA y lo deja como borrador (práctica, poliglota y gramática)
│   │   │   │   │   │   └── ai-draft-dialog.stories.ts           # [Sprint 11.2] Storybook: ai-draft-dialog (cerrado · cargando · borrador listo · error) con axe
│   │   │   │   │   ├── avatar-stage/
│   │   │   │   │   │   ├── avatar-stage.component.ts            # Escenario del avatar (voz, canto o escucha)
│   │   │   │   │   │   ├── avatar-stage.stories.ts              # [Sprint 11.2] Storybook: avatar-stage (reposo · escuchando · hablando · cantando) con axe
│   │   │   │   │   │   └── avatar-state.ts                      # Estados: en reposo, escuchando, hablando y cantando
│   │   │   │   │   ├── data-table/
│   │   │   │   │   │   ├── data-table.component.ts              # Tabla de datos accesible con desplazamiento horizontal
│   │   │   │   │   │   └── data-table.stories.ts                # [Sprint 11.2] Storybook: data-table (con datos · vacío · desplazamiento horizontal) con axe
│   │   │   │   │   ├── license-declaration/
│   │   │   │   │   │   ├── license-declaration.component.ts     # Tipo de licencia, fuente, titular y confirmación de derechos (música y diálogos)
│   │   │   │   │   │   └── license-declaration.stories.ts       # [Sprint 11.2] Storybook: license-declaration (tipos de licencia · confirmación de derechos) con axe
│   │   │   │   │   ├── portal-sidebar/
│   │   │   │   │   │   ├── portal-sidebar.component.ts          # Sidebar del portal idéntico al de Next.js (ítems por rol de packages/shared-nav)
│   │   │   │   │   │   └── portal-sidebar.stories.ts            # [Sprint 11.2] Storybook: portal-sidebar (STUDENT · TEACHER · ADMIN · oculto) con axe
│   │   │   │   │   ├── portal-topbar/
│   │   │   │   │   │   ├── portal-toolbar.component.ts          # Selectores de tema e idioma (temas e idiomas del shell Next.js)
│   │   │   │   │   │   ├── portal-toolbar.stories.ts            # [Sprint 11.2] Storybook: portal-toolbar (6 temas · ES/EN) con axe
│   │   │   │   │   │   ├── portal-topbar.component.ts           # Topbar del portal: hamburguesa, ocultar sidebar, buscador, carrito, tema, idioma y perfil
│   │   │   │   │   │   └── portal-topbar.stories.ts             # [Sprint 11.2] Storybook: portal-topbar (escritorio · móvil · con carrito) con axe
│   │   │   │   │   ├── synced-transcript/
│   │   │   │   │   │   ├── current-line.service.ts              # Calcula la línea actual con el tiempo del audio o los eventos de voz
│   │   │   │   │   │   ├── synced-transcript.component.ts       # Dos columnas: texto original con IPA y traducción al español
│   │   │   │   │   │   ├── synced-transcript.stories.ts         # [Sprint 11.2] Storybook: synced-transcript (línea actual · IPA y traducción) con axe
│   │   │   │   │   │   └── transcript-line.model.ts             # Línea: texto, IPA, traducción, inicio y fin
│   │   │   │   │   ├── toaster/
│   │   │   │   │   │   ├── toaster.component.ts                 # pinta los avisos `aula:toast` del shell Angular (abajo a la derecha; se cierran solos)
│   │   │   │   │   │   └── toaster.stories.ts                   # avisos efímeros (role="status"/"alert") que llegan por el bus AulaEvents
│   │   │   │   │   ├── voice-recorder/
│   │   │   │   │   │   ├── voice-recorder.component.ts          # Grabación con MediaRecorder y estado claro del micrófono (juegos y diálogos)
│   │   │   │   │   │   └── voice-recorder.stories.ts            # [Sprint 11.2] Storybook: voice-recorder (reposo · grabando · permiso denegado) con axe
│   │   │   │   │   └── word-lookup/
│   │   │   │   │       ├── word-card.component.ts               # ficha de una palabra — sonido, IPA (UK/US en inglés), traducción al español según la frase y «Aprendido» | «Aprender»
│   │   │   │   │       ├── word-dictionary.component.ts         # el pequeño diccionario en TODAS las pantallas Angular → seleccionar (doble clic) UNA palabra en otro idioma abre su fich…
│   │   │   │   │       ├── word-lookup.component.ts             # Ventana junto a la palabra: sonido, IPA, traducción, ejemplos y Aprender / Aprendido
│   │   │   │   │       ├── word-lookup.stories.ts               # [Sprint 11.2] Storybook: word-lookup (cargando · resultado · Aprender / Aprendido) con axe
│   │   │   │   │       └── word-lookup.element.ts               # Angular Element <aula-word-lookup>: se monta en Next.js sobre cualquier texto
│   │   │   │   ├── toaster/
│   │   │   │   │   ├── toaster.component.ts                     # Avisos breves del shell Angular (role status/alert) · 2026-10-19
│   │   │   │   │   └── toaster.stories.ts                       # [Sprint 11.2] Storybook: toaster (éxito · error · role status/alert) con axe
│   │   │   │   └── templates/                                   # Plantillas: ordenan organismos
│   │   │   │       ├── card-page.template.ts                    # Página tipo ficha con título, acciones y contenido
│   │   │   │       ├── card-page.stories.ts                     # [Sprint 11.2] Storybook: card-page (con y sin acciones) con axe
│   │   │   │       ├── two-column.template.ts                   # Dos columnas (por ejemplo, texto original + traducción)
│   │   │   │       └── two-column.stories.ts                    # [Sprint 11.2] Storybook: two-column (escritorio · móvil) con axe
│   │   │   └── utils/                                           # Utilidades
│   │   │       ├── .gitkeep                                     # Se llena cuando 2+ funcionalidades necesiten la misma función pura
│   │   │       ├── async-state.ts                               # Máquina de estados carga → éxito / vacío / error con signals (las 5 fachadas)
│   │   │       ├── event-source.ts                              # EventSource (SSE) como Observable tipado (Notifications y Reports) + parser puro parseSseText
│   │   │       └── sse-post.ts                                  # POST con respuesta SSE en streaming (Tutor IA y Agente Guía)
│   │   ├── app.component.ts                                     # Marco del portal igual que (portal)/layout.tsx de Next.js: sidebar + topbar + router-outlet
│   │   ├── app.config.ts                                        # Providers globales: router, HttpClient, i18n, tema y zoneless
│   │   ├── app.routes.ts                                        # Rutas lazy por funcionalidad (loadChildren → <nombre>.routes.ts)
│   │   └── elements.ts                                          # Registra los Angular Elements (Web Components) para Next.js
│   ├── docs/
│   │   ├── Introduccion.mdx
│   │   └── SistemaDeDiseno.mdx
│   ├── stories/                                                 # [Sprint 11.2] Páginas MDX del catálogo (no son componentes)
│   │   ├── introduction.mdx                                     # Bienvenida al catálogo: Atomic Design, cómo escribir una historia y reglas de a11y
│   │   └── themes.mdx                                           # Los temas y el modo oscuro de packages/ui-tokens con su contraste AA
│   ├── index.html                                               # HTML base: lang, meta viewport, <base href="/ng/"> y <aula-root>
│   ├── main.ts                                                  # Arranque en dos modos lazy: pantalla completa (bootstrapApplication) o solo Angular Elements
│   └── styles.css                                               # @import de apps/frontend-next/src/app/globals.css (Tailwind 4, 6 temas, utilidades btn/badge/tone)
├── __tests__/                                                   # Pruebas — misma organización que apps/frontend-next/__tests__ (Next.js) y apps/backend/__tests__ (NestJS)
│   ├── functional/                                              # Playwright: flujos de usuario de punta a punta a través del shell Next.js (:9000)
│   │   ├── checkout.spec.ts                                     # Compra con tarjeta y con criptomonedas
│   │   ├── dictionary.spec.ts                                   # Clic en una palabra: pronunciación, traducción y Aprender / Aprendido
│   │   ├── games.spec.ts                                        # Un juego de cada habilidad de punta a punta
│   │   ├── grammar.spec.ts                                      # Ficha con IPA UK/US, traducción por defecto y diccionario
│   │   ├── help.spec.ts                                         # FAQ, manual por rol y Agente Guía
│   │   ├── music-dialogues.spec.ts                              # Canción con texto sincronizado y conversación con el avatar
│   │   ├── polyglot.spec.ts                                     # Elegir tema e idiomas, reordenar columnas y escuchar un término
│   │   ├── practice.spec.ts                                     # Resolver, corregir y ver retroalimentación
│   │   ├── report-exports.spec.ts                               # Exportar PDF desde <aula-exportar> (Next.js) y seguirlo en vivo en /reportes/exportaciones
│   │   └── wallet.spec.ts                                       # Conectar billetera, pagar con ETH de prueba y verificar el certificado anclado
│   ├── integration/                                             # Jest + msw: repositorios HTTP y páginas contenedoras (carga, vacío y error)
│   │   ├── core/
│   │   │   └── session.service.spec.ts                          # Un 401 solo manda al login a quien tenía sesión (visitante de /ayuda/faq y /verificar se queda)
│   │   └── features/
│   │       ├── assistant/
│   │       │   ├── assistant.http-repository.spec.ts            # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── assistant.page.spec.ts                       # Prueba del contenedor: carga, vacío y error
│   │       ├── certificates/
│   │       │   ├── certificate-verify.page.spec.ts              # Prueba del contenedor: carga, vacío y error
│   │       │   ├── certificates.http-repository.spec.ts         # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── certificates.page.spec.ts                    # Prueba del contenedor: carga, vacío y error
│   │       ├── dialogues/
│   │       │   ├── avatar-conversation.page.spec.ts             # Prueba del contenedor: carga, vacío y error
│   │       │   ├── dialogue-hub.page.spec.ts                    # Prueba del contenedor: carga, vacío y error
│   │       │   ├── dialogue-library.page.spec.ts                # Prueba del contenedor: carga, vacío y error
│   │       │   ├── dialogue-player.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   ├── dialogue-upload.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   └── dialogues.http-repository.spec.ts            # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       ├── feedback/
│   │       │   ├── feedback.http-repository.spec.ts             # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   ├── recommendations.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   └── study-plan.page.spec.ts                      # Prueba del contenedor: carga, vacío y error
│   │       ├── forums/
│   │       │   ├── forums.http-repository.spec.ts               # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── threads.page.spec.ts                         # Prueba del contenedor: carga, vacío y error
│   │       ├── games/
│   │       │   ├── bingo.page.spec.ts                           # Prueba del contenedor: carga, vacío y error
│   │       │   ├── chained-story.page.spec.ts                   # Prueba del contenedor: carga, vacío y error
│   │       │   ├── describe-guess.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   ├── flashcards.page.spec.ts                      # Prueba del contenedor: carga, vacío y error
│   │       │   ├── fluency-dashboard.page.spec.ts               # Prueba del contenedor: carga, vacío y error
│   │       │   ├── forbidden-word.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   ├── game-result.page.spec.ts                     # Prueba del contenedor: carga, vacío y error
│   │       │   ├── games-hub.page.spec.ts                       # Prueba del contenedor: carga, vacío y error
│   │       │   ├── games.http-repository.spec.ts                # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   ├── listen-reformulate.page.spec.ts              # Prueba del contenedor: carga, vacío y error
│   │       │   ├── memory.page.spec.ts                          # Prueba del contenedor: carga, vacío y error
│   │       │   ├── partial-dictation.page.spec.ts               # Prueba del contenedor: carga, vacío y error
│   │       │   ├── quick-debate.page.spec.ts                    # Prueba del contenedor: carga, vacío y error
│   │       │   ├── quick-qa.page.spec.ts                        # Prueba del contenedor: carga, vacío y error
│   │       │   ├── quick-sort.page.spec.ts                      # Prueba del contenedor: carga, vacío y error
│   │       │   ├── random-topic.page.spec.ts                    # Prueba del contenedor: carga, vacío y error
│   │       │   ├── recovery-drills.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   ├── role-play.page.spec.ts                       # Prueba del contenedor: carga, vacío y error
│   │       │   ├── scenario-list.page.spec.ts                   # Prueba del contenedor: carga, vacío y error
│   │       │   ├── shadowing.page.spec.ts                       # Prueba del contenedor: carga, vacío y error
│   │       │   ├── speed-speaking.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   ├── taboo.page.spec.ts                           # Prueba del contenedor: carga, vacío y error
│   │       │   └── twenty-questions.page.spec.ts                # Prueba del contenedor: carga, vacío y error
│   │       ├── grammar/
│   │       │   ├── grammar-editor.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   ├── grammar-list.page.spec.ts                    # [LISTAR] Prueba del contenedor: carga, vacío y error
│   │       │   ├── grammar-topic.page.spec.ts                   # Prueba del contenedor: carga, vacío y error
│   │       │   └── grammar.http-repository.spec.ts              # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       ├── help/
│   │       │   ├── faq.page.spec.ts                             # Prueba del contenedor: carga, vacío y error
│   │       │   ├── help.http-repository.spec.ts                 # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   ├── manual-article.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   └── manual.page.spec.ts                          # Prueba del contenedor: carga, vacío y error
│   │       ├── music/
│   │       │   ├── collection-detail.page.spec.ts               # Prueba del contenedor: carga, vacío y error
│   │       │   ├── lyrics-import.service.spec.ts                # el enlace de una letra va primero al extractor de NestJS; si no es una página de texto (415) se usa el extractor general…
│   │       │   ├── music-hub.page.spec.ts                       # Prueba del contenedor: carga, vacío y error
│   │       │   ├── music.http-repository.spec.ts                # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   ├── song-player.page.spec.ts                     # Prueba del contenedor: carga, vacío y error
│   │       │   └── song-upload.page.spec.ts                     # Prueba del contenedor: carga, vacío y error
│   │       ├── notifications/
│   │       │   ├── notifications.http-repository.spec.ts        # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── notifications.page.spec.ts                   # Prueba del contenedor: carga, vacío y error
│   │       ├── own-llm/
│   │       │   └── writing-corrector.page.spec.ts               # Prueba del contenedor: carga, vacío y error
│   │       ├── payments/
│   │       │   ├── order-checkout.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   ├── payments.http-repository.spec.ts             # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── payments.page.spec.ts                        # Prueba del contenedor: carga, vacío y error
│   │       ├── polyglot/
│   │       │   ├── polyglot-builder.page.spec.ts                # Prueba del contenedor: carga, vacío y error
│   │       │   ├── polyglot.http-repository.spec.ts             # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       │   └── polyglot.page.spec.ts                        # Prueba del contenedor: carga, vacío y error
│   │       ├── practice/
│   │       │   ├── activity-builder.page.spec.ts                # Prueba del contenedor: carga, vacío y error
│   │       │   ├── practice-list.page.spec.ts                   # Prueba del contenedor: carga, vacío y error
│   │       │   ├── practice-player.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   └── practice.http-repository.spec.ts             # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       ├── reports/
│   │       │   ├── report-exports.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │       │   └── reports.http-repository.spec.ts              # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       ├── vocabulary/
│   │       │   ├── language-lookup.page.spec.ts                 # Prueba del contenedor: carga, vacío y error
│   │       │   ├── vocabulary-entry.page.spec.ts                # Prueba del contenedor: carga, vacío y error
│   │       │   └── vocabulary.http-repository.spec.ts           # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │       └── web3/
│   │           ├── crypto-payment.page.spec.ts                  # Prueba del contenedor: carga, vacío y error
│   │           ├── wallet.http-repository.spec.ts               # Prueba con msw: peticiones, errores y mapeo DTO → modelo
│   │           └── wallet.page.spec.ts                          # Prueba del contenedor: carga, vacío y error
│   ├── unit/                                                    # Jest sin red: fachadas, componentes y funciones puras (espejo de src/app)
│   │   ├── core/
│   │   │   ├── audio/
│   │   │   │   ├── server-audio.spec.ts                         # la respuesta de AULA sonaba MUDA → el audio del servidor se mide (RMS) antes de sonar; si está vacío o en silencio
│   │   │   │   ├── server-speech.spec.ts                        # servidor sin voz a texto (503 SPEECH_ENGINE_MISSING) → respaldo (dictado del navegador o escribir), sin error rojo y con…
│   │   │   │   └── speech-synthesis.spec.ts                     # la voz del sistema que NO suena (nunca arranca o da error) se notifica con `error` → el llamador cambia al audio del ser…
│   │   │   ├── dictionary/
│   │   │   │   └── dictionary.facade.spec.ts                    # Consulta, caché y marcas de aprendizaje
│   │   │   ├── routing/
│   │   │   │   └── chunk-reload.spec.ts                         # recarga una sola vez ante un chunk caducado; otros errores no recargan
│   │   │   └── idle-preloading.strategy.spec.ts                 # precarga en tiempo ocioso, respeta `data: { preload: false }` y «Ahorro de datos»
│   │   ├── features/
│   │   │   ├── assistant/
│   │   │   │   └── assistant.facade.spec.ts                     # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── certificates/
│   │   │   │   ├── certificate-pdf-hash.spec.ts                 # la huella del PDF se calcula en el navegador (Web Crypto) y se compara con la registrada/anclada en Sepolia
│   │   │   │   └── certificates.facade.spec.ts                  # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── dialogues/
│   │   │   │   └── dialogues.facade.spec.ts                     # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── feedback/
│   │   │   │   └── feedback.facade.spec.ts                      # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── forums/
│   │   │   │   └── forums.facade.spec.ts                        # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── games/
│   │   │   │   ├── games.facade.spec.ts                         # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   │   └── memory-board.spec.ts                         # como el memo de 50languages — las dos cartas de una pareja muestran la MISMA imagen + su texto
│   │   │   ├── grammar/
│   │   │   │   └── grammar.facade.spec.ts                       # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── help/
│   │   │   │   └── help.facade.spec.ts                          # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── music/
│   │   │   │   └── music.facade.spec.ts                         # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── notifications/
│   │   │   │   └── notifications.facade.spec.ts                 # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── payments/
│   │   │   │   ├── order.facade.spec.ts                         # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   │   └── payments.facade.spec.ts                      # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── polyglot/
│   │   │   │   ├── language-order.spec.ts                       # Prueba: español siempre al final salvo que el usuario lo mueva
│   │   │   │   └── polyglot.facade.spec.ts                      # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── practice/
│   │   │   │   └── practice.facade.spec.ts                      # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── reading/
│   │   │   │   ├── books-preparing.spec.ts                      # libro que el servidor aún descarga ({ preparing }) → la fachada vuelve a preguntar · salir corta el sondeo
│   │   │   │   ├── books.spec.ts                                # funciones puras del lector, Translator API → servidor, retomar progreso y carga progresiva
│   │   │   │   ├── dictation.spec.ts                            # comparación palabra por palabra del dictado (sin contar mayúsculas ni puntuación)
│   │   │   │   └── reading.spec.ts                              # palabras y sincronía (carácter, avance y estimación), IPA palabra a palabra, reproductor frase a frase (repetir, velocid…
│   │   │   ├── reports/
│   │   │   │   └── reports.facade.spec.ts                       # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   ├── vocabulary/
│   │   │   │   ├── ipa-lookup.cache.spec.ts                     # textos repetidos = una petición, 503 abre el circuito (sin tormenta de peticiones) y 4xx se recuerda
│   │   │   │   └── vocabulary.facade.spec.ts                    # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   │   └── web3/
│   │   │       └── wallet.facade.spec.ts                        # Prueba de la fachada: casos de uso y transiciones de estado con signals
│   │   └── shared/
│   │       └── ui/
│   │           ├── atoms/
│   │           │   └── button.component.spec.ts                 # Variantes, foco visible y aria-disabled
│   │           └── organisms/
│   │               ├── portal-sidebar.component.spec.ts         # Mismos ítems por rol que Next.js, avatar y regla del ítem activo
│   │               └── word-lookup.component.spec.ts            # Abre con clic y Enter, cierra con Escape, devuelve el foco
│   ├── usability/                                               # Playwright: teclado, foco y responsive en chromium, firefox y móvil
│   │   ├── keyboard-a11y.spec.ts                                # Navegación por teclado y foco en todas las pantallas
│   │   └── responsive.spec.ts                                   # Tablas y tarjetas en móvil, tablet y escritorio
│   └── utils/                                                   # Utilidades de pruebas: render, msw, a11y, EventSource falso y login e2e (alias @testing/*)
│       ├── msw/                                                 # Servidor y handlers de msw
│       │   ├── handlers.ts                                      # Handlers de /api/* para las pruebas
│       │   └── server.ts                                        # Servidor msw para Jest
│       ├── a11y.ts                                              # Helper de accesibilidad: aserciones sobre roles, nombres y foco
│       ├── e2e-session.ts                                       # Login en el shell Next.js compartido por las specs e2e
│       ├── fake-event-source.ts                                 # Doble de EventSource para jsdom (las specs emiten eventos SSE)
│       ├── games.ts                                             # Fixtures de partida y helper «jugar» (render → Empezar) de las specs de juegos
│       ├── music-dialogues.ts                                   # Fixtures de canciones, líneas, temas y diálogos de las specs de Music y Dialogues
│       ├── polyglot-grammar.ts                                  # Fixtures de consulta de palabra, palabras marcadas, tabla poliglota y ficha de gramática
│       └── render.ts                                            # Helpers: render de componentes standalone con providers de prueba
├── public/                                                      # Archivos estáticos
│   ├── fonts/
│   │   └── .gitkeep                                             # Fuentes self-hosted (sin FOUT)
│   ├── icons/
│   │   └── .gitkeep                                             # Favicons y manifest
│   ├── images/
│   │   └── .gitkeep                                             # Imágenes optimizadas (WebP) de los temas del poliglota
│   └── favicon.ico                                              # Recurso estático (imagen)
├── tools/                                                       # Herramientas de equipo
│   └── feature-template/                                        # Plantilla (schematic) que crea una funcionalidad con las cuatro capas vacías
│       ├── __name__/
│       │   ├── application/                                     # Capa Aplicación — casos de uso (SRP)
│       │   │   └── __name__.facade.ts                           # Fachada
│       │   ├── domain/                                          # Capa Dominio — sin dependencias externas (DIP)
│       │   │   ├── models/                                      # Modelos
│       │   │   │   └── __name__.ts                              # Tipos y esquemas Zod
│       │   │   └── __name__.repository.port.ts                  # Puerto
│       │   ├── infrastructure/                                  # Capa Infraestructura — Adapters concretos
│       │   │   └── __name__.http-repository.ts                  # Repositorio HTTP
│       │   ├── presentation/
│       │   │   ├── components/
│       │   │   │   └── .gitkeep                                 # Configuración
│       │   │   └── pages/                                       # Contenedores (páginas)
│       │   │       └── __name__.page.ts                         # Página
│       │   └── __name__.routes.ts                               # Rutas lazy y providers
│       └── __tests__/                                           # Pruebas de la plantilla (se copian a __tests__/ de la app)
│           ├── integration/
│           │   ├── __name__.http-repository.spec.ts             # Prueba con msw
│           │   └── __name__.page.spec.ts                        # Prueba
│           └── unit/
│               └── __name__.facade.spec.ts                      # Prueba de la fachada
├── .storybook/                                                  # [Sprint 11.2] Storybook 10 (@storybook/angular · zoneless) — catálogo de shared/ui · pnpm storybook (:6007) · pnpm build-storybook
│   ├── main.ts                                                  # Historias src/**/*.stories.ts + addons docs y a11y (axe)
│   ├── decorators.ts                                            # [Sprint 11.2] Providers de las historias: i18n, sesión falsa y HttpClient de prueba (los componentes de shared/ui usan servicios de core)
│   ├── preview.ts                                               # Decorator de tema (light/dark/sepia/hcontrast/deepfocus) + a11y.test='error'
│   ├── manager.ts                                               # [Sprint 11.2] Título, marca y panel de accesibilidad abierto por defecto
│   └── tsconfig.json                                            # Compila app + historias (tsconfig.app.json excluye *.stories.ts)
├── .editorconfig                                                # Configuración
├── .env.example                                                 # Plantilla de variables de entorno (no commitear .env)
├── .gitignore                                                   # reportes de Jest y Playwright (igual que apps/frontend-next/)
├── .postcssrc.json                                              # PostCSS con @tailwindcss/postcss (Tailwind 4)
├── .prettierrc.json                                             # Formato compartido (packages/eslint-config)
├── angular-setup.md                                             # Comandos para crear el proyecto, instalar dependencias y correr el servidor
├── angular.json                                                 # Proyecto Angular CLI: build, serve (:9100), test y storybook / build-storybook (Sprint 11.2)
├── angular_estructura.md                                        # Esta estructura (copia junto al código, igual que apps/frontend-next/next_estructura.md)
├── Dockerfile                                                   # Build estático de Angular servido con Nginx
├── Dockerfile.dockerignore                                      # ignore propio de este Dockerfile (el contexto es la raíz del monorepo)
├── eslint.config.mjs                                            # Reglas de capas (no-restricted-imports) + angular-eslint — ES module como Next.js y NestJS
├── jest.config.ts                                               # Jest: jest-fixed-jsdom, roots __tests__ (unit/ e integration/), cobertura mínima y alias de rutas
├── jest.setup.ts                                                # Inicializa Angular testing (zoneless), msw y el EventSource falso — mismo nombre que en Next.js
├── nginx.conf                                                   # Sirve el build en :9100 con cabeceras de seguridad y caché de assets
├── package.json                                                 # Dependencias y scripts (start, build, test, test:unit, test:integration, lint, e2e)
├── playwright.config.ts                                         # testDir __tests__ (functional/ y usability/), baseURL del shell Next.js :9000, navegadores y reportes
├── pnpm-lock.yaml                                               # Configuración
├── pnpm-workspace.yaml                                          # reemplaza "pnpm.onlyBuiltDependencies" de package.json (pnpm 11 ya no lo lee)
├── proxy.conf.json                                              # Desarrollo: /api/* hacia el BFF de Next.js :9000
├── README.md                                                    # Resumen del remoto Angular y enlaces a angular_estructura.md y angular-setup.md
├── tsconfig.app.json                                            # Compilación de la app
├── tsconfig.json                                                # strict:true + alias @core/* @shared/* @features/* @schemas/* @aula/* (paquetes compartidos del monorepo)
├── tsconfig.spec.json                                           # Compilación de las pruebas
└── typedoc.json                                                 # [Sprint 11.2] TypeDoc: documenta src/app (TSDoc) y se publica en el sitio MkDocs único
```

## Mapa Funcionalidad → Carpeta

| Funcionalidad | Carpeta | Cómo se publica | RF |
|---------------|---------|-----------------|----|
| Checkout y pagos (tarjeta y cripto) | `features/payments/` | Rewrite del shell (`/checkout`) | RF-87 a RF-89 · RF-91 |
| Billetera Web3 | `features/web3/` · `core/web3/` | Rewrite del shell | RF-90 |
| Certificados | `features/certificates/` | Rewrite del shell | RF-32 · RF-93 |
| Centro de ayuda y Agente Guía | `features/help/` | Rewrite + Angular Element `<aula-guia-widget>` | RF-94 a RF-97 |
| Foros por lección | `features/forums/` | Rewrite del shell | RF-72 |
| Notificaciones en tiempo real | `features/notifications/` | Rewrite + Angular Element `<aula-campana>` | RF-62 |
| Tutor IA y plan de estudio | `features/assistant/` · `features/feedback/` | Rewrite del shell | RF-57 · RF-58 |
| Exportación de reportes | `features/reports/` | Angular Element `<aula-exportar>` | RF-66 |
| Juegos y actividades | `features/games/` | Rewrite del shell (`/juegos`) | RF-98 a RF-105 |
| Traducción, IPA y diccionario | `features/vocabulary/` · `core/audio/` · `core/dictionary/` · `shared/ui/organisms/word-lookup/` · `shared/directives/` | Rewrite + Angular Elements `<aula-ipa-text>` y `<aula-word-lookup>` | RF-106 a RF-109 · RF-136 · RF-137 |
| Práctica interactiva | `features/practice/` | Rewrite del shell | RF-110 a RF-114 |
| LLM propio (corrector de redacciones) | `features/own-llm/` | Rewrite del shell (`/redaccion`) | RF-144 |
| Música y canciones | `features/music/` · `shared/ui/organisms/{avatar-stage, synced-transcript}` | Rewrite del shell (`/musica`) | RF-115 a RF-120 · RF-128 |
| Diálogos y conversación con el avatar | `features/dialogues/` | Rewrite del shell | RF-121 a RF-128 |
| Poliglota (comparador de idiomas) | `features/polyglot/` | Rewrite del shell (`/poliglota`) + opción en recursos de Next.js | RF-129 a RF-132 · RF-138 |
| Gramática | `features/grammar/` | Rewrite del shell | RF-133 a RF-135 |

## Qué Va en Cada Capa

| Capa o carpeta | Contiene | No contiene | Puede importar |
|----------------|----------|-------------|----------------|
| `domain/` | Tipos y esquemas Zod, reglas puras y el puerto del repositorio | `HttpClient`, router, componentes | Solo `domain` y bibliotecas sin framework (Zod) |
| `application/` | Fachada (casos de uso + signals) y `resource()` | HTML, `HttpClient`, detalles de la API | `domain` y `core` |
| `infrastructure/` | Repositorio HTTP que implementa el puerto, SSE y mapeadores DTO → modelo | Reglas de negocio, componentes | `domain` y `core` |
| `presentation/pages/` | Un contenedor por pantalla: inyecta la fachada y pasa datos a los componentes | Plantillas largas, llamadas HTTP | `application`, `components`, `domain/models`, `shared`, `core` |
| `presentation/components/` | Piezas de interfaz con `input()` / `output()` | Fachadas, repositorios, `HttpClient` | `domain/models` y `shared` |
| `shared/ui/` | Átomos, moléculas, organismos y plantillas reutilizables | Llamadas a la API (usan servicios de `core`) | Hacia abajo en la escala atómica, y `core` |
| `core/` | Servicios únicos: HTTP, sesión, eventos, idioma, tema, audio, viem y diccionario | Pantallas | Solo `core` |

## Reglas de Dependencia (se verifican con ESLint)

| Origen | Puede importar | No puede importar | Regla |
|--------|----------------|-------------------|-------|
| `domain` | `domain` | `application`, `infrastructure`, `presentation`, `@angular/common/http`, `@angular/router` | `no-restricted-imports` en `features/*/domain/**` |
| `application` | `domain`, `core` | `infrastructure`, `presentation`, `@angular/common/http` | `no-restricted-imports` en `features/*/application/**` |
| `infrastructure` | `domain`, `core` | `application`, `presentation` | `no-restricted-imports` en `features/*/infrastructure/**` |
| `presentation/pages` | `application`, `components`, `domain/models`, `shared`, `core` | `infrastructure` | `no-restricted-imports` |
| `presentation/components` | `domain/models`, `shared` | `application`, `infrastructure`, `@angular/common/http` | `no-restricted-imports` en `components/**` |
| `features/<a>` | `shared`, `core` | `features/<b>` | `no-restricted-imports` con `@features/**` y rutas relativas que salen de la carpeta |
| `shared` | `shared`, `core` | `features` | `no-restricted-imports` |
| `core` | `core` | `shared`, `features` | `no-restricted-imports` |
| Atomic Design | átomo → nada · molécula → átomos · organismo → moléculas y átomos · plantilla → organismos | importar hacia arriba | `no-restricted-imports` en `shared/ui/**` |

## Atomic Design en `shared/ui`

| Nivel | Qué es | Ejemplos en esta estructura |
|-------|--------|-----------------------------|
| **Átomo** | No se divide y no recibe datos del dominio | `button` · `icon` · `badge` · `spinner` · `text-input` · `ipa-label` · `avatar-svg` |
| **Molécula** | Junta átomos con una sola función | `form-field` · `accent-switch` · `pronunciation-button` · `word-token` · `transcript-line` |
| **Organismo** | Sección autónoma con datos y comportamiento propios | `word-lookup` · `synced-transcript` · `avatar-stage` · `voice-recorder` · `license-declaration` · `ai-draft-dialog` · `data-table` |
| **Plantilla** | Ordena organismos en una página | `two-column.template.ts` · `card-page.template.ts` |
| **Página** | Vive en cada funcionalidad (`presentation/pages/`) | `polyglot.page.ts` · `grammar-topic.page.ts` · `song-player.page.ts` |

## Convenciones de Nombres (homogéneas en todo el proyecto)

| Sufijo o archivo | Carpeta | Ejemplo | Qué es |
|------------------|---------|---------|--------|
| `.page.ts` | `presentation/pages/` | `polyglot.page.ts` | Componente de pantalla (contenedor) |
| `.component.ts` | `presentation/components/` · `shared/ui/` | `polyglot-table.component.ts` | Componente presentacional (plantilla y estilos Tailwind en línea) |
| `.element.ts` | `presentation/components/` · `shared/ui/organisms/` | `word-lookup.element.ts` | Componente publicado como Web Component para Next.js |
| `.template.ts` | `shared/ui/templates/` | `two-column.template.ts` | Plantilla de página |
| `.facade.ts` | `application/` | `polyglot.facade.ts` | Casos de uso y estado de la funcionalidad |
| `.resource.ts` | `application/` | `payment-status.resource.ts` | Estado de una petición con `resource()` |
| `.repository.port.ts` | `domain/` | `polyglot.repository.port.ts` | Contrato del repositorio |
| `.http-repository.ts` | `infrastructure/` | `polyglot.http-repository.ts` | Implementación con `HttpClient` |
| `.stream.ts` | `infrastructure/` | `confirmations.stream.ts` | Adaptador de flujo SSE |
| `models/<nombre>.ts` | `domain/models/` | `polyglot.ts` | Tipos y esquemas Zod |
| `.routes.ts` | raíz de la funcionalidad | `polyglot.routes.ts` | Rutas lazy y providers (puerto → repositorio) |
| `.service.ts` · `.token.ts` · `.interceptor.ts` · `.guard.ts` | `core/` | `session.service.ts` | Servicios únicos de la app |
| `.directive.ts` · `.pipe.ts` | `shared/directives/` · `presentation/pipes/` | `word-lookup.directive.ts` | Directivas y pipes |
| nombre corto | todas | `crypto-payment.stream.ts` | Verbo/entidad + sufijo, máximo unas 3 palabras; sin librerías ni detalles internos (no `crypto-payment-confirmations.stream.ts`) |
| `<entidad>-form.component.ts` | `presentation/components/` | `faq-form.component.ts` | Formulario ÚNICO de la entidad: `mode` = `create` (en blanco) · `edit` (cargado) · `view` (solo lectura); lo reutilizan alta, edición y detalle |
| `<entidad>-list.page.ts` · `<entidad>-form.page.ts` | `presentation/pages/` | `faq-list.page.ts` | CRUD: lista (`''`) y una sola página de formulario para `new`, `:id` y `:id/edit` (el modo llega por `data` de la ruta) |
| `.spec.ts` | `__tests__/unit` · `__tests__/integration` (Jest) · `__tests__/functional` · `__tests__/usability` (Playwright), como Next.js | `polyglot.facade.spec.ts` | Prueba unitaria, de integración o funcional |

Todos los nombres van en **kebab-case**, en inglés, y el nombre de la carpeta de la funcionalidad es el prefijo de sus archivos base (`polyglot.routes.ts`, `polyglot.facade.ts`, `polyglot.repository.port.ts`, `polyglot.http-repository.ts`, `models/polyglot.ts`).

## Angular Elements (Web Components para Next.js)

| Etiqueta | Archivo | Dónde se monta |
|----------|---------|----------------|
| `<aula-word-lookup>` | `shared/ui/organisms/word-lookup/word-lookup.element.ts` | Alrededor de cualquier texto de Next.js (diccionario al hacer clic) |
| `<aula-ipa-text>` | `features/vocabulary/presentation/components/ipa-text.element.ts` | Recursos y lecciones: texto con IPA por palabra |
| `<aula-guia-widget>` | `features/help/presentation/components/guide-widget.element.ts` | Layout de Next.js: widget del Agente Guía |
| `<aula-campana>` | `features/notifications/presentation/components/notification-bell.element.ts` | Encabezado de Next.js: contador de notificaciones |
| `<aula-exportar>` | `features/reports/presentation/components/report-export-button.element.ts` | Reportes de Next.js: botón de exportar |

Todos se registran en `src/app/elements.ts` y se comunican con el shell por eventos `aula:*` (`core/events/aula-events.service.ts`).

## Cómo Agregar una Funcionalidad (10 pasos)

| Paso | Qué hacer | Dónde |
|------|-----------|-------|
| 1 | Crear la carpeta con la plantilla (cuatro capas vacías) | `tools/feature-template/` → `features/<nombre>/` |
| 2 | Definir tipos y esquemas Zod (reutilizar `packages/shared-schemas`) | `domain/models/` |
| 3 | Declarar el puerto del repositorio | `domain/<nombre>.repository.port.ts` |
| 4 | Implementar el repositorio: un método por endpoint de `/api/*` | `infrastructure/<nombre>.http-repository.ts` |
| 5 | Escribir la fachada: casos de uso como métodos y estado en signals | `application/<nombre>.facade.ts` |
| 6 | Crear los componentes presentacionales con `input()` / `output()` | `presentation/components/` |
| 7 | Crear la página que inyecta la fachada (reutilizar `shared/ui` antes de crear algo nuevo) | `presentation/pages/` |
| 8 | Registrar la ruta lazy y los providers; si es pantalla del shell, sumar el *rewrite* de Next.js y `packages/shared-nav` | `<nombre>.routes.ts` · `app.routes.ts` |
| 9 | Textos en `packages/shared-i18n`, estilos con el preset de Tailwind y pruebas por capa (Jest + msw) | `packages/` · `*.spec.ts` |
| 10 | Ejecutar el lint: las reglas de capas deben pasar | ESLint |

---

## Herramientas de Testing

| Librería | Tipo de prueba | Para qué sirve |
|----------|----------------|----------------|
| Jest | Unitarias + integración | Pruebas de fachadas, repositorios, páginas y componentes (`*.spec.ts`) |
| msw (Mock Service Worker) | Integración | Intercepta `/api/*` en las pruebas sin servidor real (`__tests__/utils/msw/`) |
| Playwright | Funcionales + usabilidad | E2E en chromium, firefox y webkit: flujos (`__tests__/functional/`), teclado y responsive (`__tests__/usability/`) |
| ESLint (`no-restricted-imports`) | Arquitectura | Falla si una capa importa lo que no debe |
| Storybook 10 (@storybook/angular, zoneless) + addon a11y | Componentes + Usabilidad (a11y) | Una historia por componente de `shared/ui` con axe (`a11y.test='error'`); `pnpm storybook` (:6007) y `pnpm build-storybook` |

## Validación de Datos

| Stack | Librería | Por qué |
|-------|----------|---------|
| Frontend Angular | **Zod** | Mismos esquemas que Next.js (`packages/shared-schemas`); se usan con Signal Forms y en `domain/models/` |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| ESLint 9 + `packages/eslint-config` | Reglas comunes del monorepo y reglas de capas de Angular |
| Prettier | Formato compartido (`.prettierrc.json`) |
| TypeScript `strict: true` | Sin `any` implícito; alias `@core/*`, `@shared/*`, `@features/*` |
| Husky + lint-staged | Pre-commit: lint y formato antes de cada commit |
| TypeDoc | Documentación de código TypeScript (TSDoc) de `src/app`, publicada en el sitio MkDocs único del repositorio |

## Nota — Homogeneización respecto a la matriz

La matriz (`🅰️ Angular 22`) lista los archivos por módulo; esta estructura los ordena con las mismas reglas en todas las funcionalidades. Diferencias para que ambos documentos queden iguales:

| Ajuste | Antes (matriz) | Ahora (esta estructura) |
|--------|----------------|-------------------------|
| Componentes repetidos en varias funcionalidades | `voice-recorder` (juegos y diálogos), `license-declaration` (música y diálogos), `ai-draft-dialog` (práctica, poliglota y gramática) | Un solo organismo en `shared/ui/organisms/` (una funcionalidad no importa a otra) |
| Interruptor UK/US | `accent-switch` solo en `language-tools` | Molécula compartida `shared/ui/molecules/accent-switch/` (la usan diccionario, poliglota y gramática) |
| Nombres que chocaban | `topic-picker` en poliglota y en diálogos | `polyglot-topic-picker` y `dialogue-topic-picker` |
| Fachada de exportación | `exports.facade.ts` | `reports.facade.ts` (prefijo = carpeta) |
| Archivos base de cada funcionalidad | Solo en algunas | Todas tienen `.routes.ts`, `models/<nombre>.ts`, puerto, repositorio HTTP, fachada y sus `.spec.ts` |
| Pruebas | `__tests__/` (unit, integration, functional, usability) | `__tests__/` con la misma organización (unit, integration, functional, usability, utils) |
| Carpeta distinta al módulo | `features/tutor/` · `features/progress/` · `features/reports-export/` · `features/language-tools/` · `features/checkout/` · `features/wallet/` | `features/assistant/` · `features/feedback/` · `features/reports/` · `features/vocabulary/` · `features/payments/` (tarjeta) y `features/web3/` (cripto y billetera): carpeta = módulo de la matriz |
| Formularios con nombres distintos | `faq-editor`, `dialogue-editor`, `concept-editor`, `section-editor`, `example-editor`, `item-editor`, `thread-form`, `post-form` | `<entidad>-form.component.ts` (`faq-form`, `dialogue-form`, `polyglot-concept-form`, `grammar-section-form`, `grammar-example-form`, `practice-item-form`, `forum-thread-form`, `forum-post-form`), uno por entidad para crear, editar y ver |
| Archivos por entidad | Archivos de varias entidades mezclados en la fila del módulo | Cada fila de entidad lista solo sus archivos; los base del módulo (`.routes`, fachada, puerto, repositorio HTTP, `models/<módulo>.ts`) van en la fila de la entidad principal |
