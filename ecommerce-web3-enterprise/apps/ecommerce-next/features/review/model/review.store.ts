// review.store.ts (Redux Toolkit) => filtro por estrellas compartido entre ReviewSummary (clic en una barra) y
// ReviewList (muestra solo esa calificación). Comunicación entre componentes hermanos sin prop drilling.
// Client State: las reseñas siguen en TanStack Query; el filtro forma parte de su queryKey.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";

interface ReviewFilterState {
  rating: number | undefined;
  page: number;
}

const initialState: ReviewFilterState = { rating: undefined, page: 1 };

export const reviewFilterSlice = createSlice({
  name: "reviewFilter",
  initialState,
  reducers: {
    // Cambiar el filtro vuelve a la página 1 (los resultados cambiaron)
    setRating: (state, action: PayloadAction<number | undefined>) => {
      state.rating = action.payload;
      state.page = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
  },
});

export const useReviewFilter = createSliceHook(reviewFilterSlice);
