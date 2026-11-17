export const env = {
  appName: 'Gestión de Procesos',
  filesBackend: 'firestore' as const,
  firebase: { apiKey: 'test', authDomain: '', projectId: 'test', storageBucket: '', messagingSenderId: '', appId: '' },
  missingFirebaseKeys: [] as string[],
  loadedEnvKeys: [] as string[],
  mode: 'test',
}
