# Guía del código — qué significa cada pieza

Esta guía acompaña a los comentarios del código. Los archivos centrales están comentados **línea por línea** en español; aquí encuentras el glosario completo de palabras reservadas y conceptos, y dónde se aplica cada patrón.

## 1. Qué archivos están comentados línea por línea

| Tema | Archivos |
|---|---|
| Arranque y raíz | `src/index.tsx`, `src/AppRoot.tsx` |
| Firebase | `src/firebase/firebaseConfig.ts`, `src/services/firestoreService.ts`, `scripts/firebase-setup.mjs` |
| Redux Toolkit | `src/redux/store/store.ts`, `reducers/collectionSlice.ts`, `reducers/processReducers.ts`, `reducers/loginReducer.ts`, `actions/actionProcess.ts`, `types/types.ts` |
| TypeScript (modelo) | `src/models/index.ts` |
| Dominio y patrones | `src/services/workflow.ts` (State), `permissions.ts` (RBAC), `automation.ts` (Strategy) |
| Hooks | `src/hooks/useAuth.ts`, `useProcesses.ts`, `useDataSync.ts`, `useForm.ts`, `useFormSubmit.ts` |
| Rutas | `src/routers/PrivateRoute.tsx`, `ProtectedRoute.tsx` |
| Formularios reutilizables | `src/components/accesories/FormShell.tsx`, `src/components/uploadProcess/ProcessForm.tsx` |

El resto de los archivos (otras pantallas, tareas, usuarios, reportes…) sigue **exactamente las mismas construcciones** que estos y tiene comentarios breves de propósito. Si quieres que también queden comentados línea por línea, se puede hacer por módulos.

## 2. Arquitectura

**Arquitectura en capas** con flujo de datos unidireccional (Flux):

```
Presentación (components, routers, styles)
        ↓ usa
Estado y casos de uso (hooks, redux)
        ↓ usa
Dominio (services puros, models)
        ↓ usa
Infraestructura (firebase, firestoreService, fileStorage)
```

Flujo de lectura: `Firestore → subscribe() → dispatch(setX) → store → useAppSelector → componente`.
Flujo de escritura: `componente → hook → thunk → Firestore` (el cambio vuelve por el flujo de lectura).

## 3. CRUD por entidad

| Entidad | Listar | Crear | Ver detalle | Editar | Eliminar |
|---|---|---|---|---|---|
| Procesos | `/app/procesos` | `/app/procesos/nuevo` | `/app/procesos/:id` | `/app/procesos/:id/editar` | Botón «Eliminar» (lista y detalle) |
| Tareas | `/app/tareas` | `/app/tareas/nueva` | `/app/tareas/:id` | `/app/tareas/:id/editar` | Botón «Eliminar» |
| Usuarios | `/app/usuarios` | `/app/usuarios/nuevo` | `/app/usuarios/:uid` | `/app/usuarios/:uid/editar` | Botón «Eliminar» (borra el perfil); para bloquear el acceso, interruptor «Cuenta activa» al editar |
| Workflows | `/app/workflows` | `/app/workflows/nuevo` | `/app/workflows/:id` | `/app/workflows/:id/editar` | Botón «Eliminar» |

Crear, editar y ver detalle usan **el mismo formulario** (`ProcessForm`, `TaskForm`, `UserForm`, `WorkflowForm`) con `mode="create" | "edit" | "view"`.

**Qué ve cada rol** (si entras con una cuenta nueva ves menos opciones; es normal):

| Rol | Procesos y tareas | Usuarios y workflows |
|---|---|---|
| `admin` | Crear, editar, ver, eliminar | Todo el CRUD |
| `manager` | Crear, editar, ver, eliminar | Workflows sí; usuarios no |
| `member` | Crear, editar, ver (**no eliminar**) | Solo ver workflows; usuarios no |
| `viewer` | Solo ver | Solo ver workflows; usuarios no |

El historial (`/app/historial` y el de cada elemento) lo ven todos los roles. **El primer usuario que se registra en la aplicación queda como administrador** (ve todos los botones); los demás nacen como `member`. Si ves menos opciones de las esperadas, entra con la cuenta del primer usuario o cambia el rol desde «Usuarios y roles». Si no se puede cargar el perfil (reglas de Firestore sin publicar, base sin crear), la aplicación lo explica en pantalla en vez de ocultar los botones; ver `README.md`.

## 4. JavaScript / ES Modules

| Palabra | Qué hace | Ejemplo en el proyecto |
|---|---|---|
| `import` / `from` | Trae código exportado por otro archivo | `import { useEffect } from 'react'` |
| `import type` / `type` en llaves | Importa solo tipos (se borran al compilar) | `import type { Process } from '../models'` |
| `export` | Hace visible una declaración | `export const store = ...` |
| `export default` | La exportación principal del archivo (se importa sin llaves) | `export default function AppRoot()` |
| `const` | Variable que no se reasigna | `const dispatch = useAppDispatch()` |
| `let` | Variable que sí se reasigna | (poco usada; se prefiere `const`) |
| `function` | Declara una función | `export function useForm(...)` |
| `=>` (función flecha) | Función corta y anónima | `(p) => p.id === id` |
| `return` | Devuelve un valor y termina la función | `return () => unsubscribers.forEach(...)` |
| `if` / `else` | Condición | `if (!values.title.trim()) return ...` |
| `? :` (ternario) | Condición en una expresión | `user ? children : <Navigate />` |
| `&&` / `\|\|` | «y» / «o» lógicos (también para renderizado condicional y valores por defecto) | `{error && <Alert />}` |
| `??` | Valor alternativo solo si es `null`/`undefined` | `profile?.settings ?? DEFAULT_SETTINGS` |
| `?.` | Acceso seguro: si es null/undefined devuelve undefined | `profile?.role` |
| `...` (spread) | Copia todos los campos o elementos | `{ ...state, loading: false }` |
| Desestructuración | Saca campos de un objeto o arreglo | `const { user, checking } = useAuth()` |
| Plantilla `` `${x}` `` | Texto con valores insertados | `` `/app/procesos/${id}` `` |
| `async` / `await` | Funciones asíncronas: `await` espera una Promesa sin bloquear la página | `await create('processes', data)` |
| `Promise` / `Promise.all` | Resultado futuro / esperar varios en paralelo | `await Promise.all(...)` |
| `try` / `catch` / `finally` | Manejo de errores (`finally` siempre se ejecuta) | `useFormSubmit.ts` |
| `throw new Error()` | Lanza un error | `throw new Error('Proceso no encontrado')` |
| `new` | Crea una instancia de una clase | `new GoogleAuthProvider()` |
| `instanceof` | ¿Es instancia de esa clase? | `err instanceof Error` |
| `map` / `filter` / `find` / `includes` / `forEach` / `sort` / `join` / `slice` / `indexOf` | Métodos de arreglos (estilo funcional) | `items.find((p) => p.id === id)` |
| `===` / `!==` | Igualdad / desigualdad estricta (valor y tipo) | `mode === 'view'` |

## 5. TypeScript

| Palabra / símbolo | Qué hace | Ejemplo |
|---|---|---|
| `type` | Alias de tipo | `type Role = 'admin' \| 'member'` |
| `interface` | Forma de un objeto | `interface Process { id: string ... }` |
| `extends` | Hereda campos (interface) o restringe un genérico | `UserProfile extends AuthUser` · `<T extends { id: string }>` |
| `\|` (unión) | Uno u otro tipo | `string \| null` |
| `&` (intersección) | Combina tipos | `UserProfile & { id: string }` |
| Tipo literal | Un valor exacto como tipo | `'create' \| 'edit' \| 'view'` |
| `<T>` (genérico) | Un tipo que se decide al usarlo | `createCollectionSlice<Process>('process')` |
| `?` | Campo o parámetro opcional | `error?: string \| null` |
| `Record<K, V>` | Objeto con una clave por cada K | `Record<Role, string>` |
| `Partial<T>` / `Pick<T, K>` | Todos los campos opcionales / solo algunos campos | `Partial<ProcessInput>` |
| `keyof T` | Nombres de los campos de T | `keyof Process` |
| `typeof x` / `ReturnType<>` | Tipo de un valor / tipo que devuelve una función | `ReturnType<typeof store.getState>` |
| `as` / `as const` | Aserción de tipo / fijar literales | `as HTMLElement` |
| `satisfies` | Verifica la forma sin ensanchar el tipo | en las historias de Storybook |
| `unknown` | «Cualquier cosa», obliga a comprobar antes de usar | `Promise<unknown>` |
| `x is T` | Type guard: le dice al compilador qué tipo queda | `(s): s is string => Boolean(s)` |
| `: Tipo` | Anotación de tipo de variable, parámetro o resultado | `(id: string): Process` |

## 6. React

| Concepto | Qué es | Dónde verlo |
|---|---|---|
| Componente funcional | Función que devuelve JSX | `AppRoot.tsx` |
| JSX | HTML dentro de JavaScript; `className` en vez de `class`, `htmlFor` en vez de `for` | `ProcessForm.tsx` |
| Props | Entradas del componente; `children` = lo que va entre las etiquetas | `FormShell.tsx` |
| `<>...</>` Fragment | Agrupa sin añadir un elemento al HTML | `AppRoot.tsx` |
| `key` | Identifica elementos de una lista | `{PRIORITIES.map((p) => <option key={p} />)}` |
| `useState` | Estado local; al cambiar, redibuja | `useFormSubmit.ts` |
| `useEffect` | Efectos secundarios y limpieza (suscripciones) | `useDataSync.ts` |
| `useCallback` / `useMemo` | Memorizan funciones / cálculos | `useAuth.ts` |
| `useRef` | Referencia mutable que no redibuja | tablero Kanban |
| Custom hook | Función `use...` con lógica reutilizable | `useForm`, `useFormSubmit`, `useProcesses` |
| Componente controlado | El valor del campo vive en React | `value={values.title} onChange={handleChange}` |
| Renderizado condicional | `&&`, ternario o `if` antes del `return` | `FormShell`, `PrivateRoute` |
| `lazy` / `Suspense` | Carga una pantalla solo cuando se visita | `routers/DashboardRoutes.tsx` |
| `StrictMode` | Controles extra en desarrollo | `index.tsx` |
| Provider (Context) | Inyecta un valor a todos los hijos | `<Provider store={store}>` |

React Router: `BrowserRouter` (habilita las rutas), `Routes`/`Route` (tabla de rutas), `Navigate` (redirige), `Link`/`NavLink` (enlaces sin recargar), `useParams` (lee `:id`), `useNavigate` (navega por código), `useLocation` (URL actual).

## 7. Redux Toolkit

| Concepto | Qué es | Dónde verlo |
|---|---|---|
| Store | Almacén único del estado global | `redux/store/store.ts` |
| `configureStore` | Crea el store con buenas prácticas | `store.ts` |
| Slice / `createSlice` | Un trozo del estado con su reducer y sus acciones | `collectionSlice.ts`, `loginReducer.ts` |
| Reducer | Función pura `(estado, acción) → nuevo estado` | `reducers/` |
| Acción / `payload` | Mensaje que describe qué pasó, con sus datos | `setProcesses(lista)` |
| `dispatch` | Envía una acción o un thunk al store | `useAppDispatch()` |
| Selector / `useAppSelector` | Lee una parte del estado y se suscribe a sus cambios | `useProcesses.ts` |
| Thunk | Función asíncrona `(dispatch, getState) => ...` para casos de uso con Firebase | `actions/actionProcess.ts` |
| `RootState` / `AppDispatch` | Tipos deducidos del store | `store.ts` |
| Inmutabilidad | Nunca se modifica el estado: se devuelve uno nuevo | `{ ...state, loading: false }` |

## 8. Firebase

| Concepto | Qué hace | Dónde |
|---|---|---|
| `initializeApp` | Conecta con tu proyecto | `firebaseConfig.ts` |
| Authentication | Cuentas con correo/contraseña y Google (Firebase gestiona OAuth, JWT y sesiones) | `actionLogin.ts` |
| `onAuthStateChanged` | Avisa cada vez que alguien inicia o cierra sesión (Observer) | `AppRoot.tsx` |
| `signInWithEmailAndPassword`, `signInWithPopup`, `createUserWithEmailAndPassword` | Entrar con correo, con Google y registrarse | `actionLogin.ts`, `actionRegister.ts` |
| Firestore | Base de datos de documentos en tiempo real | `firestoreService.ts` |
| `collection` / `doc` | Referencia a una colección / a un documento | `firestoreService.ts` |
| `addDoc` / `setDoc` / `updateDoc` / `deleteDoc` / `getDoc` | Crear / reemplazar o mezclar / modificar campos / borrar / leer una vez | `firestoreService.ts` |
| `onSnapshot` | Escucha cambios en tiempo real (devuelve cómo cancelar) | `subscribe()` |
| `query`, `where`, `orderBy`, `limitToLast` | Filtrar, ordenar y limitar | `useDataSync.ts`, `useChat.ts` |
| Caché persistente | Guarda datos en el navegador para trabajar sin conexión | `firebaseConfig.ts` |
| Reglas de seguridad | El servidor decide quién lee o escribe (`match`, `allow`, `request.auth`, `get()`) | `firestore.rules` |
| firebase-admin | SDK con permisos de administrador, solo para scripts de terminal | `scripts/firebase-setup.mjs` |

## 9. Patrones de diseño

| Patrón | Para qué se usa aquí | Dónde |
|---|---|---|
| **Facade** | Una interfaz sencilla sobre Firestore; el resto no conoce el SDK | `services/firestoreService.ts` |
| **Observer** | Firestore y Authentication avisan de cambios; el store se actualiza solo | `AppRoot.tsx`, `useDataSync.ts`, `subscribe()` |
| **Factory Method** | Fabrica el slice de cada colección | `redux/reducers/collectionSlice.ts` |
| **State** | Reglas del flujo según el estado actual (solo avanzar/retroceder uno) | `services/workflow.ts` |
| **Strategy** | Cada acción de automatización y cada formato de exportación es una función intercambiable | `services/automation.ts`, `services/reportExport.ts` |
| **Adapter** | Convierte el usuario de Firebase al formato de la app; unifica los dos modos de guardar archivos | `toAuthUser`, `services/fileStorage.ts` |
| **Chain of Responsibility** (versión simple) | El asistente evalúa una lista de «intenciones» en orden y responde la primera que coincide | `services/assistant.ts` |
| **Hooks** | Lógica reutilizable fuera de los componentes | `src/hooks/` |
| **Container / Presentational** | Contenedores leen datos; los presentacionales solo pintan | `KanbanBoard` (contenedor) y `KanbanColumn`/`TaskCard` |
| **Composition** | Componentes que reciben otros como `children` | `FormShell`, `PrivateRoute`, `ProtectedRoute` |
| **Compound Components / Command** | No se usan: no aportaban una solución real | — |

## 10. Paradigmas

- **Declarativo**: se describe la interfaz (JSX) y React decide cómo actualizar el DOM.
- **Funcional**: funciones puras (`services/`, reducers), inmutabilidad, `map`/`filter`, hooks.
- **Orientado a objetos**: casi no se usa (solo instancias de clases de Firebase como `GoogleAuthProvider`); se prefirió composición y funciones, como pedía el criterio de «sin sobreingeniería».
- **Basado en eventos**: `onSnapshot`, `onAuthStateChanged`, `onChange`, `onClick`, automatizaciones.
- **Asíncrono**: `async/await` y Promesas en todo lo que habla con Firebase.

## 11. Principios

| Principio | Ejemplo |
|---|---|
| **S**ingle Responsibility | `firestoreService` solo habla con Firestore; `workflow.ts` solo conoce el flujo |
| **O**pen/Closed | Para añadir una acción de automatización se registra una función en `handlers` |
| **L**iskov / **I**nterface Segregation | Props pequeñas y específicas (`FormShell`, `TaskCard`) |
| **D**ependency Inversion | Los componentes dependen de hooks, no de Redux ni de Firebase |
| DRY | Un formulario por entidad para crear/editar/ver; una fábrica de slices |
| KISS | Reglas de roles en una matriz; sin librerías de gráficos ni de formularios extra donde bastaba lo simple |
| Separación de responsabilidades | Capas: presentación, estado, dominio e infraestructura |

## 12. Lógica clave del sistema

- **Permisos**: `can(rol, permiso)` consulta `ROLE_PERMISSIONS`; la interfaz oculta lo que no se puede hacer y `firestore.rules` lo impide en el servidor.
- **Workflow**: un proceso solo puede avanzar o retroceder un estado; al llegar al último se guarda `finishedAt`.
- **Historial**: cada thunk llama a `logHistory`; la colección solo admite agregar documentos.
- **Indicadores**: `services/indicators.ts` calcula avance, cumplimiento de fechas y tiempo por estado a partir de procesos, tareas e historial reales (sin datos de relleno).
- **Alertas**: `services/alerts.ts` calcula vencidos y próximos a vencer al abrir la app.
- **Eliminación en cascada**: borrar un proceso borra sus tareas y archivos.
- **Cuentas desactivadas**: `active: false` impide leer y escribir según `firestore.rules`.
