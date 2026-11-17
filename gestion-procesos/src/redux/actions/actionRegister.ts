import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../../firebase/firebaseConfig'
import { registerActions } from '../reducers/registerReducer'
import type { AppThunk } from '../store/store'
import { friendlyAuthError, loadSession } from './actionLogin'

export const startRegister =
  (name: string, email: string, password: string): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    dispatch(registerActions.start())
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: name })
      // El perfil lo crea loadSession (el primer usuario queda como administrador y completa el nombre).
      await dispatch(loadSession(user))
      dispatch(registerActions.end())
      return true
    } catch (error) {
      dispatch(registerActions.fail(friendlyAuthError(error)))
      return false
    }
  }
