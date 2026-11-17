# Estructura de carpetas — Arquitectura en capas (Layered Architecture)

Arquitectura **en capas por tipo de archivo**, basada en componentes (React) y con **flujo de datos unidireccional** (Flux, mediante Redux Toolkit). Cada capa solo depende de la que tiene debajo.

| Capa | Carpetas | Responsabilidad |
|---|---|---|
| 1. Presentación | `components/`, `routers/`, `styles/` | Pantallas, rutas privadas/protegidas y estilos (SMACSS + BEM). Componentes contenedores y presentacionales |
| 2. Estado y casos de uso | `hooks/`, `redux/` | Hooks que exponen los datos a la interfaz, slices, acciones (thunks) y store |
| 3. Dominio | `services/`, `models/` | Reglas del negocio puras y fáciles de probar: permisos, workflow, indicadores, filtros, alertas, reportes, asistente |
| 4. Infraestructura | `firebase/`, `services/firestoreService.ts`, `services/fileStorage.ts`, `services/authAdmin.ts` | Acceso a Firebase (autenticación, Firestore, archivos) |

Flujo de datos: `Firestore → useDataSync → slices de Redux → hooks → componentes`; las acciones del usuario viajan en sentido contrario: `componente → hook → acción (thunk) → Firestore`.

No es Feature-Sliced Design ni una arquitectura por módulos de negocio: las carpetas se agrupan por el tipo de archivo, como en el proyecto original, para no hacer una reestructuración innecesaria. Si el proyecto crece, el siguiente paso natural sería agrupar por módulo (`features/procesos`, `features/tareas`…).

```
gestion-procesos/
├── .storybook/
│   ├── fixtures.ts
│   ├── main.ts
│   └── preview.tsx
├── cypress/
│   ├── e2e/
│   │   ├── auth.cy.ts
│   │   ├── landing.cy.ts
│   │   └── rutas-privadas.cy.ts
│   ├── support/
│   │   └── e2e.ts
│   └── tsconfig.json
├── database/
│   ├── ESQUEMA_BASE_DE_DATOS.md
│   └── schema.json
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   ├── robots.txt
│   └── sitemap.xml
├── scripts/
│   ├── check-env.mjs
│   └── firebase-setup.mjs
├── src/
│   ├── __tests__/
│   │   └── index.test.tsx
│   ├── asset/
│   │   └── .gitkeep
│   ├── components/
│   │   ├── accesories/
│   │   │   ├── __tests__/
│   │   │   │   ├── FormShell.test.tsx
│   │   │   │   └── MissingConfig.test.tsx
│   │   │   ├── DataErrorBanner.tsx
│   │   │   ├── FormShell.stories.tsx
│   │   │   ├── FormShell.tsx
│   │   │   ├── MissingConfig.tsx
│   │   │   ├── NotFoundNotice.stories.tsx
│   │   │   ├── NotFoundNotice.tsx
│   │   │   ├── PageHeader.stories.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── ProfileLoadError.tsx
│   │   │   ├── Seo.tsx
│   │   │   ├── Spinner.stories.tsx
│   │   │   └── Spinner.tsx
│   │   ├── admin/
│   │   │   ├── __tests__/
│   │   │   │   └── UserForm.test.tsx
│   │   │   ├── AddUser.tsx
│   │   │   ├── EditUser.tsx
│   │   │   ├── UserDetail.tsx
│   │   │   ├── UserForm.stories.tsx
│   │   │   ├── UserForm.tsx
│   │   │   └── UserManagement.tsx
│   │   ├── ai/
│   │   │   ├── AIAssistant.tsx
│   │   │   └── AskAssistant.tsx
│   │   ├── automation/
│   │   │   └── AutomationRules.tsx
│   │   ├── calendar/
│   │   │   └── CalendarView.tsx
│   │   ├── chat/
│   │   │   ├── CanalEnSidebar.tsx
│   │   │   ├── CanalRoute.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── EncabezadoChat.tsx
│   │   │   ├── Mensaje.tsx
│   │   │   └── Sliderbar.tsx
│   │   ├── dashboard/
│   │   │   ├── BarChart.stories.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── files/
│   │   │   ├── DocumentsPage.tsx
│   │   │   └── FileManager.tsx
│   │   ├── getProcess/
│   │   │   ├── ActiveProcesses.tsx
│   │   │   ├── AssignedProcesses.tsx
│   │   │   ├── DetailProcess.tsx
│   │   │   ├── EditProcesses.tsx
│   │   │   ├── ProcessFilterBar.tsx
│   │   │   └── SearchProcesses.tsx
│   │   ├── helpers/
│   │   │   ├── confirm.ts
│   │   │   └── ConvertirId.ts
│   │   ├── history/
│   │   │   ├── HistoryPage.tsx
│   │   │   └── HistoryTimeline.tsx
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── ProcessCard.tsx
│   │   │   ├── ProcessKanban.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── TaskKanban.tsx
│   │   ├── Landing/
│   │   │   └── LandingPage.tsx
│   │   ├── menuinicial/
│   │   │   └── InitialMenu.tsx
│   │   ├── notifications/
│   │   │   └── NotificationsPage.tsx
│   │   ├── Register/
│   │   │   ├── Register.tsx
│   │   │   ├── SingUp.tsx
│   │   │   └── TextField.tsx
│   │   ├── reports/
│   │   │   └── ReportsPage.tsx
│   │   ├── tasks/
│   │   │   ├── __tests__/
│   │   │   │   └── TaskForm.test.tsx
│   │   │   ├── AddTask.tsx
│   │   │   ├── EditTask.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── TaskForm.stories.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   └── TaskList.tsx
│   │   ├── uploadProcess/
│   │   │   ├── __tests__/
│   │   │   │   └── ProcessForm.test.tsx
│   │   │   ├── AddProcess.tsx
│   │   │   ├── ProcessForm.stories.tsx
│   │   │   └── ProcessForm.tsx
│   │   ├── workflow/
│   │   │   ├── __tests__/
│   │   │   │   └── WorkflowForm.test.tsx
│   │   │   ├── WorkflowDetail.tsx
│   │   │   ├── WorkflowEditor.tsx
│   │   │   ├── WorkflowForm.stories.tsx
│   │   │   ├── WorkflowForm.tsx
│   │   │   ├── WorkflowManager.tsx
│   │   │   ├── WorkflowStepper.stories.tsx
│   │   │   └── WorkflowStepper.tsx
│   │   ├── Login.tsx
│   │   ├── MenuNavigation.tsx
│   │   ├── NavBar.tsx
│   │   ├── ProcessInformation.stories.tsx
│   │   ├── ProcessInformation.tsx
│   │   └── Profile.tsx
│   ├── config/
│   │   ├── __tests__/
│   │   │   └── firebaseCheck.test.ts
│   │   ├── env.ts
│   │   └── firebaseCheck.ts
│   ├── docs/
│   │   ├── Estilos.mdx
│   │   └── Introduccion.mdx
│   ├── firebase/
│   │   └── firebaseConfig.ts
│   ├── hooks/
│   │   ├── __tests__/
│   │   │   └── useFormSubmit.test.ts
│   │   ├── useAI.ts
│   │   ├── useAuth.ts
│   │   ├── useAutomation.ts
│   │   ├── useCalendar.ts
│   │   ├── useChat.ts
│   │   ├── useDashboard.ts
│   │   ├── useDataSync.ts
│   │   ├── useFiles.ts
│   │   ├── useForm.ts
│   │   ├── useFormSubmit.ts
│   │   ├── useHistory.ts
│   │   ├── useNotifications.ts
│   │   ├── useProcesses.ts
│   │   ├── useRedux.ts
│   │   ├── UserPerfil.ts
│   │   ├── useTasks.ts
│   │   ├── useTranslation.ts
│   │   ├── useUsers.ts
│   │   └── useWorkflow.ts
│   ├── models/
│   │   └── index.ts
│   ├── redux/
│   │   ├── actions/
│   │   │   ├── actionAutomation.ts
│   │   │   ├── actionFile.ts
│   │   │   ├── actionHelpers.ts
│   │   │   ├── actionLogin.ts
│   │   │   ├── actionNotification.ts
│   │   │   ├── actionProcess.ts
│   │   │   ├── actionRegister.ts
│   │   │   ├── actionTask.ts
│   │   │   ├── actionUser.ts
│   │   │   └── actionWorkflow.ts
│   │   ├── reducers/
│   │   │   ├── automationReducers.ts
│   │   │   ├── collectionSlice.ts
│   │   │   ├── fileReducers.ts
│   │   │   ├── loginReducer.ts
│   │   │   ├── notificationReducers.ts
│   │   │   ├── processReducers.ts
│   │   │   ├── registerReducer.ts
│   │   │   ├── taskReducers.ts
│   │   │   ├── userReducers.ts
│   │   │   └── workflowReducers.ts
│   │   ├── selectors/
│   │   │   └── selectors.ts
│   │   ├── store/
│   │   │   └── store.ts
│   │   └── types/
│   │       └── types.ts
│   ├── routers/
│   │   ├── __tests__/
│   │   │   └── ProtectedRoute.test.tsx
│   │   ├── AppRouter.tsx
│   │   ├── DashboardRoutes.tsx
│   │   ├── PrivateRoute.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── PublicRoute.tsx
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── profile.test.ts
│   │   │   ├── reportExport.test.ts
│   │   │   ├── schema.test.ts
│   │   │   └── services.test.ts
│   │   ├── ai.ts
│   │   ├── alerts.ts
│   │   ├── assistant.ts
│   │   ├── authAdmin.ts
│   │   ├── automation.ts
│   │   ├── dates.ts
│   │   ├── fileStorage.ts
│   │   ├── filters.ts
│   │   ├── firestoreService.ts
│   │   ├── history.ts
│   │   ├── indicators.ts
│   │   ├── notifications.ts
│   │   ├── permissions.ts
│   │   ├── profile.ts
│   │   ├── reportExport.ts
│   │   ├── reports.ts
│   │   ├── translation.ts
│   │   └── workflow.ts
│   ├── styles/
│   │   ├── base/
│   │   │   ├── _base.scss
│   │   │   └── _variables.scss
│   │   ├── layout/
│   │   │   └── _layout.scss
│   │   ├── modules/
│   │   │   ├── _assistant.scss
│   │   │   ├── _auth-card.scss
│   │   │   ├── _entity-form.scss
│   │   │   ├── _page-header.scss
│   │   │   ├── _panels.scss
│   │   │   ├── _process-item.scss
│   │   │   ├── _row-list.scss
│   │   │   ├── _stepper.scss
│   │   │   ├── _summary.scss
│   │   │   └── _timeline.scss
│   │   ├── state/
│   │   │   └── _state.scss
│   │   ├── theme/
│   │   │   └── _theme.scss
│   │   ├── config.scss
│   │   ├── MenuNavigation.scss
│   │   ├── NavBar.scss
│   │   ├── Spinner.module.scss
│   │   ├── StyleActiveProcesses.scss
│   │   ├── StyleAddProcess.scss
│   │   ├── StyleAssignedProcesses.scss
│   │   ├── StyleCalendar.scss
│   │   ├── StyleChat.scss
│   │   ├── StyleDashboard.scss
│   │   ├── StyleDetailProcess.scss
│   │   ├── styleinitmenu.scss
│   │   ├── StyleKanban.scss
│   │   ├── styleLanding.scss
│   │   ├── StyleLogin.scss
│   │   ├── StyleProfile.scss
│   │   └── StyleRegister.scss
│   ├── AppRoot.tsx
│   ├── crud.visibility.test.tsx
│   ├── index.tsx
│   ├── stories.smoke.test.tsx
│   └── vite-env.d.ts
├── test/
│   ├── envStub.ts
│   ├── polyfills.ts
│   ├── renderWithRouter.tsx
│   └── setupTests.ts
├── .dockerignore
├── .editorconfig
├── .env.e2e
├── .env.example
├── .firebaserc
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── cypress.config.ts
├── DEPENDENCIAS.md
├── docker-compose.yml
├── Dockerfile
├── eslint.config.js
├── ESTRUCTURA_CARPETAS.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── GUIA_DEL_CODIGO.md
├── index.html
├── jest.config.cjs
├── nginx.conf
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── storage.rules
├── tsconfig.json
└── vite.config.ts
```

`pnpm-lock.yaml` se genera con `pnpm install`; `node_modules/`, `dist/`, `coverage/` y `storybook-static/` no se incluyen.

## Carpetas de calidad y documentación

- `src/**/__tests__/` y `*.test.ts(x)`: pruebas con Jest + Testing Library, junto al código que prueban.
- `test/`: configuración compartida de Jest (preparación, polyfills, variables de entorno simuladas, ayudantes).
- `cypress/`: pruebas end-to-end (`e2e/`) y su configuración.
- `.storybook/` y `src/**/*.stories.tsx`: documentación de componentes; `src/docs/*.mdx` son las guías.
- `database/`: esquema de la base de datos (`schema.json`, `ESQUEMA_BASE_DE_DATOS.md`).
- `scripts/check-env.mjs`: revisa el archivo `.env` y explica qué falta (`pnpm env:check`).
- `scripts/firebase-setup.mjs`: script de terminal que valida y sube el esquema a Firebase y crea el primer administrador.
- `GUIA_DEL_CODIGO.md`: glosario y explicación del código comentado.
- `src/config/env.ts` y `firebaseCheck.ts`: único lugar que lee las variables de entorno y comprueba que la configuración de Firebase esté completa.

## Cambios de nombre respecto al proyecto original

- `L.js` → `src/AppRoot.tsx` (escucha la sesión de Firebase y monta el enrutador).
- `index.js` → `index.tsx`, `setupTests.js` → `test/setupTests.ts`; el resto de archivos `.js` conservan su nombre con extensión `.tsx` o `.ts`.
- Los estilos `.css` ahora son `.scss` con el mismo nombre; se añadieron las capas `base/`, `layout/`, `modules/`, `state/` y `theme/` (SMACSS).

docker compose down
docker compose up --build -d
Nombre del contenedor
Contenedor: gestion-procesos (en desarrollo: gestion-procesos-dev).
Imagen: gestion-procesos:latest.
Proyecto de Docker Compose: gestion-procesos.

Los ves con docker ps.