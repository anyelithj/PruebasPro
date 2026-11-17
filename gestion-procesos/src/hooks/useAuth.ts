// ═══════════════════════════════════════════════════════════════════════════════════════
// useAuth.ts — CUSTOM HOOK que expone la sesión y las operaciones de autenticación a los componentes.
// Patrón: FACADE (los componentes no conocen Redux ni Firebase; solo llaman `login()`, `logout()`, `can()`…).
// Arquitectura: capa de ESTADO/CASOS DE USO: puente entre la presentación (componentes) y el estado (Redux).
// ═══════════════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react'
// Configuración por defecto si el perfil aún no cargó.
import { DEFAULT_SETTINGS } from '../models'
// Thunks (acciones asíncronas) de autenticación.
import {
  reloadSession,
  startGoogleLogin,
  startLogin,
  startLogout,
  startPasswordReset,
} from '../redux/actions/actionLogin'
import { startRegister } from '../redux/actions/actionRegister'
// `can`: función pura que consulta la matriz rol → permisos.
import { can, type Permission } from '../services/permissions'
import { useAppDispatch, useAppSelector } from './useRedux'

export function useAuth() {
  // `dispatch`: envía acciones al store.
  const dispatch = useAppDispatch()
  // `useAppSelector`: lee una parte del estado. Si esa parte cambia, el componente se vuelve a dibujar.
  const { user, profile, checking, error } = useAppSelector((s) => s.login)
  const register = useAppSelector((s) => s.register)
  // `?.` (encadenamiento opcional): si `profile` es null devuelve undefined en vez de lanzar error.
  const role = profile?.role

  return {
    user,
    profile,
    role,
    checking,
    error,
    register,
    // `??` (coalescencia nula): usa la configuración del perfil o, si no existe, la de por defecto.
    settings: profile?.settings ?? DEFAULT_SETTINGS,
    // ¿Puede el usuario actual hacer X? Se usa para ocultar botones y proteger rutas.
    can: useCallback((permission: Permission) => can(role, permission), [role]),
    // Cada operación despacha un thunk; las funciones se memorizan con useCallback (referencias estables).
    login: useCallback((email: string, password: string) => dispatch(startLogin(email, password)), [dispatch]),
    loginWithGoogle: useCallback(() => dispatch(startGoogleLogin()), [dispatch]),
    resetPassword: useCallback((email: string) => dispatch(startPasswordReset(email)), [dispatch]),
    signUp: useCallback(
      (name: string, email: string, password: string) => dispatch(startRegister(name, email, password)),
      [dispatch],
    ),
    reloadProfile: useCallback(() => dispatch(reloadSession()), [dispatch]),
    logout: useCallback(() => dispatch(startLogout()), [dispatch]),
  }
}
