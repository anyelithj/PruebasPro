// search.store.ts (Redux Toolkit + localStorage) => búsquedas recientes LOCALES para visitantes sin sesión
// (los usuarios autenticados usan el historial del servidor en MongoDB, vía TanStack Query).
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";

const MAX_RECENT = 8;

interface LocalRecentState {
  recent: string[];
}

const initialState: LocalRecentState = { recent: [] };

export const localRecentSearchesSlice = createSlice({
  name: "localRecentSearches",
  initialState,
  reducers: {
    // Sin duplicados (insensible a mayúsculas) y la más reciente primero
    remember: (state, action: PayloadAction<string>) => {
      const query = action.payload;
      state.recent = [query, ...state.recent.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT);
    },
    clear: () => initialState,
    hydrate: (state, action: PayloadAction<Partial<LocalRecentState>>) => ({ ...state, ...action.payload }),
  },
});

export const useLocalRecentSearches = createSliceHook(localRecentSearchesSlice);
