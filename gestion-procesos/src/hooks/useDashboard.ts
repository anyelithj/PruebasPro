import { selectIndicators } from '../redux/selectors/selectors'
import { useAppSelector } from './useRedux'

/** Indicadores de procesos y tareas ligados al flujo de cada proceso. */
export function useDashboard() {
  return useAppSelector(selectIndicators)
}
