// Comprobación de la configuración de Firebase. Es una función PURA (no lee `import.meta`), por eso se puede probar fácilmente.

// Cada par es [nombre del campo en la configuración, nombre de la variable de entorno que lo llena].
// Solo se exigen los campos sin los cuales Firebase NO puede iniciar (storageBucket y messagingSenderId son opcionales).
const REQUIRED: [string, string][] = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
]

/** Devuelve los nombres de las variables de entorno que faltan o están vacías (lista vacía = configuración completa). */
export function findMissingFirebaseKeys(config: Record<string, string | undefined>): string[] {
  return REQUIRED.filter(([field]) => !config[field]?.trim()).map(([, variable]) => variable)
}
