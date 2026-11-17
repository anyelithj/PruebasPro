import { act, renderHook } from '@testing-library/react'
import { useFormSubmit } from '../useFormSubmit'

describe('useFormSubmit', () => {
  it('devuelve true y no deja error si la acción funciona', async () => {
    const { result } = renderHook(() => useFormSubmit())
    let ok = false
    await act(async () => {
      ok = await result.current.run(async () => undefined)
    })
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.saving).toBe(false)
  })

  it('guarda el mensaje del error si la acción falla', async () => {
    const { result } = renderHook(() => useFormSubmit())
    let ok = true
    await act(async () => {
      ok = await result.current.run(async () => {
        throw new Error('Sin permisos')
      })
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('Sin permisos')
  })

  it('usa el mensaje por defecto si el error no trae texto', async () => {
    const { result } = renderHook(() => useFormSubmit('Mensaje por defecto'))
    await act(async () => {
      await result.current.run(() => Promise.reject('x'))
    })
    expect(result.current.error).toBe('Mensaje por defecto')
  })
})
