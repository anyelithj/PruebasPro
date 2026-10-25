// media.store.ts (Redux Toolkit) => Client State del Media Manager admin: filtros (carpeta, texto, etiqueta y tipo:
// RF-26.1) y selección múltiple.
// Los archivos (URLs de Cloudinary, metadatos) son Server State (TanStack Query en media.api.ts): aquí NO se copian.
// Patrón Observer (store) + Singleton (un store por pestaña del navegador).
// "import" (ES Modules) => createSlice genera reducer + actions; PayloadAction tipa el payload (TypeScript)
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
// createSliceHook => helper DRY del proyecto: crea el hook useXxx() que lee/despacha este slice
import { createSliceHook } from "@/shared/lib/store";
import type { MediaFilters } from "../api/media.api";

// "interface" (TypeScript) => forma del estado; solo primitivos serializables (requisito de Redux)
interface MediaLibraryState {
  filters: MediaFilters; // Carpeta, texto, etiqueta y tipo ("" = sin filtro)
  selected: string[]; // publicIds seleccionados (array y no Set: Redux exige estado serializable)
}

const initialState: MediaLibraryState = { filters: { folder: "", q: "", tag: "", type: "" }, selected: [] };

// "export const" => el slice se registra en providers.tsx (combineSlices) bajo la clave "mediaLibrary"
export const mediaLibrarySlice = createSlice({
  name: "mediaLibrary",
  initialState,
  reducers: {
    // Cambiar un filtro limpia la selección: evita borrar archivos que ya no se ven (UX + seguridad).
    // "Partial" => se actualiza solo lo que llega (spread sobre el borrador de Immer)
    setFilters: (state, action: PayloadAction<Partial<MediaFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.selected = [];
    },
    // toggleSelected => agrega o quita un publicId (Immer permite "mutar" el borrador de forma segura)
    toggleSelected: (state, action: PayloadAction<string>) => {
      const i = state.selected.indexOf(action.payload);
      if (i === -1) state.selected.push(action.payload);
      else state.selected.splice(i, 1);
    },
    clearSelected: (state) => {
      state.selected = [];
    },
  },
});

// useMediaLibrary() => { filters, selected, setFilters, toggleSelected, clearSelected } para features/media/ui
export const useMediaLibrary = createSliceHook(mediaLibrarySlice);
