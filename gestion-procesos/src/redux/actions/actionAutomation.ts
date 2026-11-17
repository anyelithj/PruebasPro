import type { AutomationRule } from '../../models'
import { create, patch, remove } from '../../services/firestoreService'
import type { AppThunk } from '../store/store'
import { getActor } from './actionHelpers'
import { automationError, setAutomations } from '../reducers/automationReducers'

export { automationError, setAutomations }

export type RuleInput = Pick<AutomationRule, 'name' | 'trigger' | 'action'>

export const addRule =
  (input: RuleInput): AppThunk<Promise<string>> =>
  async (_d, getState) =>
    create('automations', { ...input, enabled: true, createdBy: getActor(getState()).uid })

export const toggleRule =
  (rule: AutomationRule): AppThunk<Promise<void>> =>
  async () =>
    patch('automations', rule.id, { enabled: !rule.enabled })

export const removeRule =
  (id: string): AppThunk<Promise<void>> =>
  async () =>
    remove('automations', id)
