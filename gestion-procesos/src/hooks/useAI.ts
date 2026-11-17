import { useCallback, useState } from 'react'
import { analyze, type AIResult } from '../services/ai'

export function useAI() {
  const [result, setResult] = useState<AIResult | null>(null)
  const run = useCallback((text: string) => setResult(text.trim() ? analyze(text) : null), [])
  const reset = useCallback(() => setResult(null), [])
  return { result, analyze: run, reset }
}
