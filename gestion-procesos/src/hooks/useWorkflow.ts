import { useCallback, useMemo } from 'react'
import { addWorkflow, deleteWorkflow, editWorkflow } from '../redux/actions/actionWorkflow'
import { selectWorkflows } from '../redux/selectors/selectors'
import { DEFAULT_WORKFLOW } from '../services/workflow'
import { useAppDispatch, useAppSelector } from './useRedux'

export function useWorkflow() {
  const dispatch = useAppDispatch()
  const workflows = useAppSelector(selectWorkflows)
  const processes = useAppSelector((s) => s.process.items)

  const getWorkflow = useCallback((id?: string) => workflows.find((w) => w.id === id) ?? DEFAULT_WORKFLOW, [workflows])
  const usage = useMemo(() => {
    const map = new Map<string, number>()
    processes.forEach((p) => map.set(p.workflowId, (map.get(p.workflowId) ?? 0) + 1))
    return map
  }, [processes])

  return {
    workflows,
    getWorkflow,
    processCount: useCallback((id: string) => usage.get(id) ?? 0, [usage]),
    add: useCallback((name: string, states: string[]) => dispatch(addWorkflow(name, states)), [dispatch]),
    edit: useCallback(
      (id: string, name: string, states: string[]) => dispatch(editWorkflow(id, name, states)),
      [dispatch],
    ),
    remove: useCallback((id: string) => dispatch(deleteWorkflow(id)), [dispatch]),
  }
}
