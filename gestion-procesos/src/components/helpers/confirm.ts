import Swal from 'sweetalert2'

/** Diálogo de confirmación reutilizable para eliminar. Devuelve true si la persona confirma. */
export async function confirmDelete(title: string, text = 'Esta acción no se puede deshacer.'): Promise<boolean> {
  const { isConfirmed } = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#b3412f',
  })
  return isConfirmed
}

export const showError = (error: unknown) =>
  Swal.fire({
    icon: 'error',
    title: 'No se pudo completar',
    text: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
    confirmButtonColor: '#1b4d6b',
  })
