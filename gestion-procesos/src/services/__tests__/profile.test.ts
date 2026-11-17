import type { UserProfile } from '../../models'
import * as db from '../firestoreService'
import { ensureProfile } from '../profile'

jest.mock('../firestoreService', () => ({
  read: jest.fn(),
  save: jest.fn(),
  patch: jest.fn(),
  claimFirstAdmin: jest.fn(),
}))
const mocked = jest.mocked(db)

const user = { uid: 'u1', email: 'ana@ejemplo.co', displayName: 'Ana', photoURL: null }

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('ensureProfile', () => {
  it('devuelve el perfil existente sin crear nada', async () => {
    mocked.read.mockResolvedValueOnce({ ...user, role: 'manager', active: true, createdAt: 1 })
    const profile = await ensureProfile(user)
    expect(profile.role).toBe('manager')
    expect(mocked.save).not.toHaveBeenCalled()
    expect(mocked.claimFirstAdmin).not.toHaveBeenCalled()
  })

  it('el PRIMER usuario queda como administrador', async () => {
    mocked.read.mockResolvedValueOnce(null) // no hay perfil
    mocked.read.mockResolvedValueOnce(null) // nadie reclamó _meta/admin
    const profile = await ensureProfile(user)
    expect(profile.role).toBe('admin')
    expect(mocked.claimFirstAdmin).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', role: 'admin' }))
    expect(mocked.save).not.toHaveBeenCalled()
  })

  it('si el administrador ya existe, el nuevo usuario es miembro', async () => {
    mocked.read.mockResolvedValueOnce(null) // no hay perfil
    mocked.read.mockResolvedValueOnce({ id: 'admin', uid: 'otro' } as never) // _meta/admin ya existe
    mocked.read.mockResolvedValueOnce(null) // sigue sin perfil
    const profile = await ensureProfile(user)
    expect(profile.role).toBe('member')
    expect(mocked.claimFirstAdmin).not.toHaveBeenCalled()
    expect(mocked.save).toHaveBeenCalledWith('users', 'u1', expect.objectContaining({ role: 'member' }))
  })

  it('si reclamar el rol falla (otro usuario fue más rápido), continúa como miembro', async () => {
    mocked.read.mockResolvedValueOnce(null)
    mocked.read.mockResolvedValueOnce(null)
    mocked.claimFirstAdmin.mockRejectedValueOnce(new Error('permission-denied'))
    mocked.read.mockResolvedValueOnce(null)
    const profile = await ensureProfile(user)
    expect(profile.role).toBe('member')
    expect(mocked.save).toHaveBeenCalled()
  })

  it('si Firestore rechaza la lectura, propaga el error para mostrarlo en pantalla', async () => {
    mocked.read.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await expect(ensureProfile(user)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('completa el nombre si el perfil aún no lo tiene (registro)', async () => {
    mocked.read.mockResolvedValueOnce({
      ...user,
      displayName: '',
      role: 'member',
      active: true,
      createdAt: 1,
    } as UserProfile)
    const profile = await ensureProfile(user)
    expect(mocked.patch).toHaveBeenCalledWith('users', 'u1', { displayName: 'Ana' })
    expect(profile.displayName).toBe('Ana')
  })
})
