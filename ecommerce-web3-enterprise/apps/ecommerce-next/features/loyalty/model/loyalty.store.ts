// loyalty.store.ts (Redux Toolkit) => insignia seleccionada en la galería (panel de detalle con datos on-chain).
// Client State: solo el ID elegido; los datos de la insignia vienen de TanStack Query.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";

interface BadgeSelectionState {
  selectedBadgeId: string | null;
}

const initialState: BadgeSelectionState = { selectedBadgeId: null };

export const badgeSelectionSlice = createSlice({
  name: "badgeSelection",
  initialState,
  reducers: {
    select: (state, action: PayloadAction<string | null>) => {
      state.selectedBadgeId = action.payload;
    },
  },
});

export const useBadgeSelection = createSliceHook(badgeSelectionSlice);
