"use client"; // [Next.js]: Client Component → diálogo interactivo (Radix)
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [ResultDialog]: ventana modal "se creó con éxito" / "error" tras guardar curso, examen o recurso | [Patrón]: Presentational + Controlled Component | [Principio]: SRP + DRY (un solo diálogo para los tres formularios)
// [a11y]: Radix Dialog → foco atrapado, Escape cierra, `aria-modal`; título y descripción enlazados (WAI-ARIA dialog)

// [Resultado]: `null` = cerrado | unión discriminada por `ok` (TS)
export type SaveResult = { ok: true; message: string } | { ok: false; message: string };

export interface ResultDialogProps {
  result: SaveResult | null;
  onClose: () => void; // Éxito: el formulario navega aquí (Continuar, X o Escape) · Error: solo cierra y se corrige el formulario
}

export function ResultDialog({ result, onClose }: ResultDialogProps) {
  const { t } = usePreferences();
  const r = t.common.result;
  return (
    // `open` controlado: `onOpenChange(false)` (Radix) llega con Escape, clic fuera o la X
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* [Icono de estado]: decorativo (aria-hidden); el texto del título ya comunica el resultado */}
            <span
              aria-hidden
              className={`grid size-8 place-items-center rounded-full text-base ${result?.ok ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-danger-soft text-tone-danger"}`}
            >
              {result?.ok ? "✓" : "!"}
            </span>
            {result?.ok ? r.success : r.error}
          </DialogTitle>
          <DialogDescription className="pt-1 text-sm">{result?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" autoFocus onClick={onClose} className={`btn ${result?.ok ? "btn-primary" : "btn-outline"}`}>
            {result?.ok ? r.continue : r.close}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
