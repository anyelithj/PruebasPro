# Dependencias a instalar

Requisitos: **Node.js 22 o superior** (Cypress 16 lo exige) y **pnpm** (el proyecto declara `pnpm@12.9.1` en `packageManager`).

## Instalación

```bash
npm install -g pnpm   # si aún no lo tienes (o: corepack enable)
pnpm install
```

`pnpm-workspace.yaml` indica qué dependencias pueden ejecutar scripts de instalación. Solo se permiten las de herramientas de desarrollo
(Cypress descarga su binario; SWC, esbuild y unrs-resolver verifican sus binarios). El resto queda bloqueado, por ejemplo `onnxruntime-node`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en http://localhost:5173 |
| `pnpm build` | Revisa tipos y compila a `dist/` |
| `pnpm preview` | Sirve la compilación |
| `pnpm typecheck` | Solo revisa tipos |
| `pnpm lint` / `pnpm lint:fix` | ESLint (con reglas de accesibilidad) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Jest + Testing Library |
| `pnpm e2e` | Levanta la app con `.env.e2e` y ejecuta Cypress |
| `pnpm cypress:open` | Cypress en modo interactivo (con `pnpm dev:e2e` en otra terminal) |
| `pnpm storybook` | Documentación de componentes en http://localhost:6006 |
| `pnpm build-storybook` | Genera la documentación estática en `storybook-static/` |
| `pnpm env:check` | Revisa que el `.env` tenga la configuración de Firebase y explica qué falta (`pnpm dev` lo ejecuta al iniciar) |
| `pnpm db:check` / `pnpm db:setup` / `pnpm db:deploy` | Esquema de la base de datos: validar, subir a Firestore y publicar reglas (ver `database/`) |
| `pnpm check` | Tipos + lint + formato + pruebas (para correr antes de subir cambios) |

## Producción (`dependencies`)

| Paquete | Versión | Para qué se usa |
|---|---|---|
| @huggingface/transformers | ^4.3.1 | Traducción gratuita en el navegador (modelos abiertos Opus-MT) |
| @reduxjs/toolkit | ^2.13.0 | Estado global (slices, thunks y adaptadores de entidades) |
| bootstrap | ^5.3.8 | Estilos y rejilla (con Sass) |
| docx | ^9.8.1 | Reportes en Word (.docx) |
| exceljs | ^4.4.0 | Reportes en Excel (.xlsx) |
| file-saver | ^2.0.5 | Descarga de archivos en el navegador |
| firebase | ^12.19.0 | Autenticación (correo y Google), Firestore y, opcionalmente, Storage |
| formik | ^2.4.9 | Formularios de login y registro |
| jspdf | ^4.2.1 | Reportes en PDF |
| jspdf-autotable | ^5.0.8 | Tablas dentro del PDF |
| lodash | ^4.18.1 | Utilidades de agrupación |
| react | ^19.3.0 | Interfaz (antes 17) |
| react-bootstrap | ^2.10.10 | Componentes accesibles de Bootstrap |
| react-dom | ^19.3.0 | Interfaz (antes 17) |
| react-icons | ^5.7.0 | Iconos |
| react-redux | ^9.3.0 | Conexión de React con Redux |
| react-router-dom | ^7.18.4 | Rutas públicas, privadas y protegidas |
| sweetalert2 | ^11.26.25 | Confirmación al eliminar |
| yup | ^1.7.1 | Validación de formularios |

## Desarrollo (`devDependencies`)

| Paquete | Versión | Para qué se usa |
|---|---|---|
| @eslint/js | ^9.39.5 | Reglas base de ESLint |
| @storybook/addon-a11y | ^10.6.1 | Pestaña de accesibilidad |
| @storybook/addon-docs | ^10.6.1 | Páginas de documentación |
| @storybook/react-vite | ^10.6.1 | Storybook para React + Vite |
| @swc/core | ^1.16.13 | Compilador usado por Jest |
| @swc/jest | ^0.2.39 | Conecta SWC con Jest |
| @testing-library/dom | ^10.4.2 | Consultas de DOM |
| @testing-library/jest-dom | ^7.0.1 | Comprobaciones de DOM |
| @testing-library/react | ^16.3.3 | Pruebas de componentes |
| @testing-library/user-event | ^14.6.7 | Simulación de acciones del usuario |
| @types/file-saver | ^2.0.7 | Tipos |
| @types/jest | ^30.0.0 | Tipos |
| @types/lodash | ^4.17.25 | Tipos |
| @types/node | ^26.6.4 | Tipos |
| @types/react | ^19.3.0 | Tipos |
| @types/react-dom | ^19.3.0 | Tipos |
| @vitejs/plugin-react | ^6.1.2 | Soporte de React en Vite |
| cypress | ^16.1.1 | Pruebas end-to-end |
| firebase-admin | ^14.5.0 | Script de terminal que sube el esquema y crea el primer administrador (solo desarrollo) |
| eslint | ^9.39.5 | Análisis de código (versión 9: los plugins de accesibilidad aún no soportan la 10) |
| eslint-config-prettier | ^10.1.8 | Evita choques entre ESLint y Prettier |
| eslint-plugin-jsx-a11y | ^6.10.2 | Reglas de accesibilidad en JSX |
| eslint-plugin-react-hooks | ^7.1.1 | Reglas de hooks |
| eslint-plugin-storybook | ^10.6.1 | Reglas para las historias |
| globals | ^17.13.0 | Variables globales para ESLint |
| identity-obj-proxy | ^3.0.0 | Simula archivos de estilos en Jest |
| jest | ^30.5.2 | Pruebas unitarias y de componentes |
| jest-environment-jsdom | ^30.5.2 | Navegador simulado para Jest |
| jsdom | ^30.1.2 | Entorno de navegador |
| prettier | ^3.9.9 | Formato de código |
| sass | ^1.105.1 | Compilador de Sass |
| start-server-and-test | ^3.0.12 | Levanta la app y ejecuta Cypress |
| storybook | ^10.6.1 | Documentación de componentes |
| typescript | ~6.0.3 | Tipado estático (se fija en 6.0 porque typescript-eslint aún no es compatible con TypeScript 7) |
| typescript-eslint | ^8.71.1 | Reglas de ESLint para TypeScript |
| vite | ^8.3.3 | Servidor de desarrollo y compilación |

## Qué cambió respecto a tu `package.json` original

**Actualizadas:** react, react-dom, react-router-dom, firebase, bootstrap, react-bootstrap, react-icons, formik, yup, react-redux, sweetalert2, lodash, file-saver y las librerías de pruebas.

**Reemplazadas:**
- `react-scripts` (Create React App está descontinuado y no soporta React 19) → **Vite**. Sigue siendo renderizado en el cliente (CSR).
- `redux` + `redux-thunk` → **@reduxjs/toolkit**, que ya los incluye.
- `npm` → **pnpm** (`pnpm-lock.yaml` reemplaza a `package-lock.json`).
- Pruebas de CRA → **Jest** con SWC (sin Babel) + Testing Library, y **Cypress** para end-to-end.

**Eliminadas por estar duplicadas o sin uso:** `@mui/material`, `@material-ui/core`, `@material-ui/icons`, `@emotion/*`, `@ant-design/icons`, `reactstrap`, `grommet-icons`, `@trendmicro/react-sidenav`, `react-responsive-sidebar`, `classnames`, `uuid`, `web-vitals`.

**Nuevas:** `exceljs`, `docx`, `jspdf` y `jspdf-autotable` (reportes), `@huggingface/transformers` (traducción) y las herramientas de calidad (ESLint, Prettier, Jest, Cypress, Storybook).

**Dos versiones fijadas a propósito:**
- **TypeScript 6.0** (no 7): `typescript-eslint` todavía no es compatible con TypeScript 7.
- **ESLint 9** (no 10): `eslint-plugin-jsx-a11y` aún no declara compatibilidad con ESLint 10.

Todo es gratuito y de código abierto. No hay claves de IA ni servicios de pago.
