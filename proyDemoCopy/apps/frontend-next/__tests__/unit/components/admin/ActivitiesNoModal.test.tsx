// [Test Gestión → Actividades sin modales · 2026-10-24]: confirmación de borrado EN la fila (RowActions confirm="inline") y editor de filas del borrador (DraftEditor)
// [Patrón]: Component Test (React Testing Library) + Mock del proveedor de textos | [Principio]: se prueba el comportamiento visible (roles y nombres accesibles), no la implementación
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RowActions } from "@/components/admin/RowActions";
import { DraftEditor } from "@/components/activities/DraftEditor";
import { ACTIVITY_KINDS } from "@/lib/activity-kinds";

// [Mocks]: textos de la interfaz, router y toast (RowActions los usa; aquí no importan)
jest.mock("@/components/layout/PreferencesProvider", () => ({
  usePreferences: () => ({ t: { common: { deleted: "Eliminado" }, management: { row: { view: "Ver", edit: "Editar", delete: "Eliminar", cancel: "Cancelar", deleting: "Eliminando…", deleteConfirm: "¿Eliminar «{title}»?", publish: "Publicar", unpublish: "Despublicar", published: "", unpublished: "" } } } }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/components/shared/Toaster", () => ({ toast: jest.fn() }));

describe("RowActions confirm=inline", () => {
  it("confirma dentro de la fila, sin role=dialog, y ejecuta el borrado", async () => {
    const onDelete = jest.fn(async () => ({ ok: true as const }));
    render(<RowActions title="Café" deleteTitle="Eliminar «Café»" onDelete={onDelete} confirm="inline" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const group = screen.getByRole("group", { name: "Eliminar «Café»" });
    expect(group).toHaveTextContent("¿Eliminar «Café»?");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus(); // Opción segura enfocada
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" }).at(-1)!);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});

describe("DraftEditor", () => {
  it("pinta los campos de la estrategia, edita y quita filas", () => {
    const onChange = jest.fn();
    render(<DraftEditor strategy={ACTIVITY_KINDS.dialogues} entries={[{ _uid: "a", speaker: "A", text: "Hi" }, { _uid: "b", speaker: "B", text: "Hello" }]} onChange={onChange} />);
    expect(screen.getByRole("list", { name: "Guion del diálogo" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText(/Frase/)[0]!, { target: { value: "Hey" } });
    expect(onChange).toHaveBeenLastCalledWith([{ _uid: "a", speaker: "A", text: "Hey" }, { _uid: "b", speaker: "B", text: "Hello" }]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar turno 2" }));
    expect(onChange).toHaveBeenLastCalledWith([{ _uid: "a", speaker: "A", text: "Hi" }]);
  });
});
