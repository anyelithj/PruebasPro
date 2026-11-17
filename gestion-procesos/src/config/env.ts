import { findMissingFirebaseKeys } from './firebaseCheck'

/** Único lugar donde se lee `import.meta.env`: el resto de la app importa `env`, lo que facilita las pruebas y los cambios de entorno. */
const firebase = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.REACT_APP_FIREBASE_APP_ID,
}

export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Gestión de Procesos',
  filesBackend: import.meta.env.VITE_FILES_BACKEND === 'storage' ? ('storage' as const) : ('firestore' as const),
  firebase,
  /** Variables de Firebase que faltan en el archivo .env (vacía si todo está configurado). */
  missingFirebaseKeys: findMissingFirebaseKeys(firebase),
  /** Solo nombres (nunca valores) de las variables VITE_/REACT_APP_ que Vite sí cargó: sirve para diagnosticar un .env que no se lee. */
  loadedEnvKeys: Object.keys(import.meta.env).filter((k) => /^(VITE_|REACT_APP_)/.test(k)),
  /** Modo de Vite: development, production, etc. */
  mode: import.meta.env.MODE,
}
