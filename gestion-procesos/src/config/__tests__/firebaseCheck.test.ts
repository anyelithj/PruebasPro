import { findMissingFirebaseKeys } from '../firebaseCheck'

const complete = { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' }

describe('findMissingFirebaseKeys', () => {
  it('no reporta nada si la configuración está completa', () => {
    expect(findMissingFirebaseKeys(complete)).toEqual([])
  })

  it('reporta todas las variables si no hay ninguna (el caso del error auth/invalid-api-key)', () => {
    expect(findMissingFirebaseKeys({})).toEqual([
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_APP_ID',
    ])
  })

  it('considera vacío un valor con solo espacios', () => {
    expect(findMissingFirebaseKeys({ ...complete, apiKey: '   ' })).toEqual(['VITE_FIREBASE_API_KEY'])
  })

  it('no exige los campos opcionales', () => {
    expect(findMissingFirebaseKeys({ ...complete, storageBucket: undefined })).toEqual([])
  })
})
