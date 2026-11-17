import type { AutomationRule } from '../../models'
import { createCollectionSlice } from './collectionSlice'

export const automationSlice = createCollectionSlice<AutomationRule>('automation')
export const { setItems: setAutomations, setError: automationError } = automationSlice.actions
export const automationReducer = automationSlice.reducer
