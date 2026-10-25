import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CourseGroup } from "@/types/courses";
// [Slice Courses]: estado UI del catálogo (filtros + búsqueda + reacciones locales) | [Patrón]: Redux Slice + State | [Principio]: SRP

export interface CoursesUIState {
  activeGroup: CourseGroup | "ALL";
  search: string;
  eje: number | null;
  // [Reacciones optimistas]: clave courseId → snapshot | [Principio]: SSOT cliente
  reactions: Record<string, { like: boolean; love: boolean; favorite: boolean }>;
}

const initialState: CoursesUIState = {
  activeGroup: "ALL",
  search: "",
  eje: null,
  reactions: {},
};

const coursesSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {
    setActiveGroup(state, action: PayloadAction<CourseGroup | "ALL">) {
      state.activeGroup = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setEje(state, action: PayloadAction<number | null>) {
      state.eje = action.payload;
    },
    // [hydrateReactions]: poblar desde respuesta del backend | [Patrón]: Hydration
    hydrateReactions(
      state,
      action: PayloadAction<{ id: string; like: boolean; love: boolean; favorite: boolean }[]>,
    ) {
      for (const r of action.payload) {
        state.reactions[r.id] = { like: r.like, love: r.love, favorite: r.favorite };
      }
    },
    toggleLocalReaction(
      state,
      action: PayloadAction<{ courseId: string; kind: "like" | "love" | "favorite" }>,
    ) {
      const { courseId, kind } = action.payload;
      const cur = state.reactions[courseId] ?? { like: false, love: false, favorite: false };
      state.reactions[courseId] = { ...cur, [kind]: !cur[kind] };
    },
    resetFilters(state) {
      state.activeGroup = "ALL";
      state.search = "";
      state.eje = null;
    },
  },
});

export const {
  setActiveGroup,
  setSearch,
  setEje,
  hydrateReactions,
  toggleLocalReaction,
  resetFilters,
} = coursesSlice.actions;

export default coursesSlice.reducer;

// [Selectors] | [Patrón]: Selector | [Principio]: DRY
export const selectActiveGroup = (s: { courses: CoursesUIState }) => s.courses.activeGroup;
export const selectSearch = (s: { courses: CoursesUIState }) => s.courses.search;
export const selectEje = (s: { courses: CoursesUIState }) => s.courses.eje;
export const selectReaction =
  (courseId: string) =>
  (s: { courses: CoursesUIState }) =>
    s.courses.reactions[courseId] ?? { like: false, love: false, favorite: false };
