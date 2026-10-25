import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import quizReducer from "./slices/quizSlice";
// [Store root]: composición Redux Toolkit | [Patrón]: Store + DI | [Principio]: SSOT | [Paradigma]: FP

// [makeStore]: factory para SSR-safe (cada request server crea su store) | [Patrón]: Factory
export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      quiz: quizReducer,
    },
    // [DevTools]: habilitar solo en desarrollo
    devTools: process.env.NODE_ENV !== "production",
  });

// [Tipos derivados]: para hooks tipados useAppDispatch / useAppSelector | [Principio]: SSOT
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
