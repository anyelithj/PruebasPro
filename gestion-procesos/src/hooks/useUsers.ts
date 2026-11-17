import { useCallback } from 'react'
import { createUser, editUser, removeUser, type EditUserInput, type NewUserInput } from '../redux/actions/actionUser'
import { selectUserNames } from '../redux/selectors/selectors'
import type { UserProfile } from '../models'
import { useAppDispatch, useAppSelector } from './useRedux'

export function useUsers() {
  const dispatch = useAppDispatch()
  const { items, loading, error } = useAppSelector((s) => s.user)
  const names = useAppSelector(selectUserNames)

  return {
    users: items,
    loading,
    error,
    getById: useCallback((uid?: string) => items.find((u) => u.uid === uid), [items]),
    nameOf: useCallback((uid: string) => (uid ? (names.get(uid) ?? 'Usuario') : 'Sin asignar'), [names]),
    add: useCallback((input: NewUserInput) => dispatch(createUser(input)), [dispatch]),
    edit: useCallback(
      (user: UserProfile, input: Partial<EditUserInput>) => dispatch(editUser(user, input)),
      [dispatch],
    ),
    remove: useCallback((user: UserProfile) => dispatch(removeUser(user)), [dispatch]),
  }
}
