// ═══════════════════════════════════════════════════════════════════════════════════════
// firebaseConfig.ts — conexión con FIREBASE (capa de INFRAESTRUCTURA).
// Es el único archivo que crea la conexión; el resto de la app importa `auth` y `db` desde aquí (patrón SINGLETON:
// los módulos de ES se ejecutan una sola vez, así que `app`, `auth` y `db` existen una sola vez en toda la app).
// ═══════════════════════════════════════════════════════════════════════════════════════

// `env`: objeto con las variables de entorno (.env). Se lee en un solo lugar para poder simularlo en las pruebas.
import { env } from '../config/env'
// `initializeApp`: crea la aplicación Firebase con las claves de tu proyecto.
import { initializeApp } from 'firebase/app'
// `getAuth`: obtiene el servicio de AUTENTICACIÓN. `GoogleAuthProvider`: clase para «Iniciar sesión con Google».
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
// Firestore (base de datos de documentos). `persistentLocalCache` guarda datos en el navegador para trabajar sin conexión
// y `persistentMultipleTabManager` permite que varias pestañas compartan esa caché.
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// `export const`: exporta una constante para que otros archivos la importen.
// Las claves de Firebase para web NO son secretas (identifican el proyecto); la seguridad real está en firestore.rules.
export const firebaseConfig = env.firebase

// Crea la app de Firebase. Todos los servicios (Auth, Firestore) cuelgan de ella.
export const app = initializeApp(firebaseConfig)
// Servicio de autenticación: correo/contraseña y Google (JWT/OAuth los resuelve Firebase, no se implementan a mano).
export const auth = getAuth(app)
// Servicio de base de datos.
export const db = initializeFirestore(app, {
  // Firestore rechaza campos con valor `undefined`; con esta opción simplemente los ignora.
  ignoreUndefinedProperties: true,
  // Caché local persistente (IndexedDB): la app abre rápido y tolera cortes de internet.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Proveedor de Google para el botón «Continuar con Google».
// `new`: palabra reservada que crea una instancia de una clase.
export const googleProvider = new GoogleAuthProvider()
// Fuerza a Google a mostrar el selector de cuenta (útil si hay varias cuentas abiertas en el navegador).
googleProvider.setCustomParameters({ prompt: 'select_account' })
