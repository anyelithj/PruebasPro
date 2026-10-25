"use client";
import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from ".";
// [StoreProvider]: Client Component que monta Redux Provider | [Patrón]: Provider (React Context) | [Principio]: SRP | [Paradigma]: Funcional + JSX

// [Provider]: UN store por instancia del árbol React (no se recrea en re-renders) | [Patrón]: Singleton-by-component
export function StoreProvider({ children }: { children: React.ReactNode }) {
  // `useState(makeStore)` (React): inicialización perezosa → makeStore corre solo en el primer render; sin leer refs durante el render (regla React 19)
  const [store] = useState<AppStore>(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
