// [Test utils]: helpers compartidos para tests con Redux | [Patrón]: Test Harness | [Principio]: DRY
import React, { type PropsWithChildren } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import authReducer from "@/store/slices/authSlice";
import quizReducer from "@/store/slices/quizSlice";

// [makeTestStore]: store aislado por test (replica makeStore real) | [Patrón]: Factory
export const makeTestStore = (preloadedState?: Record<string, unknown>) =>
  configureStore({
    reducer: { auth: authReducer, quiz: quizReducer },
    preloadedState: preloadedState as never,
  });

export type TestStore = ReturnType<typeof makeTestStore>;

// [StoreWrapper]: Provider para renderHook/render | [Patrón]: Wrapper
export function makeStoreWrapper(store: TestStore) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}
