import { useCallback, useMemo } from 'react'
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '../redux/actions/actionNotification'
import { selectProcesses, selectTasks, selectWorkflows } from '../redux/selectors/selectors'
import { computeAlerts } from '../services/alerts'
import { useAppDispatch, useAppSelector } from './useRedux'

/** Notificaciones guardadas + alertas derivadas de fechas límite (vencidos y próximos a vencer). */
export function useNotifications() {
  const dispatch = useAppDispatch()
  const notifications = useAppSelector((s) => s.notification.items)
  const processes = useAppSelector(selectProcesses)
  const tasks = useAppSelector(selectTasks)
  const workflows = useAppSelector(selectWorkflows)
  const uid = useAppSelector((s) => s.login.user?.uid ?? '')
  const dueSoonDays = useAppSelector((s) => s.login.profile?.settings.dueSoonDays ?? 2)

  const alerts = useMemo(
    () => computeAlerts({ processes, tasks, workflows, uid, dueSoonDays }),
    [processes, tasks, workflows, uid, dueSoonDays],
  )
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  return {
    notifications,
    alerts,
    unread,
    total: unread + alerts.length,
    markRead: useCallback((id: string) => dispatch(markNotificationRead(id)), [dispatch]),
    markAllRead: useCallback(() => dispatch(markAllNotificationsRead()), [dispatch]),
    remove: useCallback((id: string) => dispatch(deleteNotification(id)), [dispatch]),
  }
}
