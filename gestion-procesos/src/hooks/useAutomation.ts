import { useCallback } from 'react'
import type { AutomationRule } from '../models'
import { addRule, removeRule, toggleRule, type RuleInput } from '../redux/actions/actionAutomation'
import { useAppDispatch, useAppSelector } from './useRedux'

export type { RuleInput }

export function useAutomation() {
  const dispatch = useAppDispatch()
  const rules = useAppSelector((s) => s.automation.items)
  return {
    rules,
    add: useCallback((input: RuleInput) => dispatch(addRule(input)), [dispatch]),
    toggle: useCallback((rule: AutomationRule) => dispatch(toggleRule(rule)), [dispatch]),
    remove: useCallback((id: string) => dispatch(removeRule(id)), [dispatch]),
  }
}
