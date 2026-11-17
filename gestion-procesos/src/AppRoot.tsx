// ═══════════════════════════════════════════════════════════════════════════════════════
// AppRoot.tsx — antes `L.js`. Componente raíz: sincroniza la SESIÓN de Firebase con Redux y monta las rutas.
// Patrón: OBSERVER (Firebase «avisa» cada vez que alguien inicia o cierra sesión).
// Paradigmas: basado en EVENTOS (callback de sesión) y ASÍNCRONO (la sesión llega en cualquier momento).
// ═══════════════════════════════════════════════════════════════════════════════════════

// `onAuthStateChanged`: función de Firebase Authentication. Registra un «oyente» que se ejecuta cuando cambia la sesión.
import { onAuthStateChanged } from 'firebase/auth'
// `useEffect`: hook de React para ejecutar código DESPUÉS de dibujar (efectos secundarios: suscripciones, llamadas a APIs…).
import { useEffect } from 'react'
// `auth`: instancia de Firebase Authentication ya configurada (ver firebase/firebaseConfig.ts).
import { auth } from './firebase/firebaseConfig'
// `useAppDispatch`: versión tipada de useDispatch (react-redux); devuelve la función para enviar acciones al store.
import { useAppDispatch } from './hooks/useRedux'
// `loadSession`: «thunk» (acción asíncrona) que carga o crea el perfil del usuario en Firestore y lo guarda en Redux.
import { loadSession } from './redux/actions/actionLogin'
// El enrutador con rutas públicas, privadas y protegidas.
import AppRouter from './routers/AppRouter'

/** Antes `L.js`: sincroniza la sesión de Firebase con Redux y monta las rutas. */
// `export default`: este archivo exporta UNA cosa principal. `function`: declara una función; en React, una función
// que devuelve JSX es un COMPONENTE FUNCIONAL (paradigma funcional: componentes = funciones).
export default function AppRoot() {
  // Hook: obtiene `dispatch`. Los nombres que empiezan con `use` son hooks y solo pueden llamarse en el nivel superior de un componente.
  // `const`: declara una variable que no se reasigna.
  const dispatch = useAppDispatch()

  // `useEffect(función, [dependencias])`: la función corre al montar el componente y cada vez que cambie algo del arreglo.
  useEffect(() => {
    // Observer: Firebase notifica cada cambio de sesión.
    // `return`: lo que devuelve el efecto es su función de LIMPIEZA. `onAuthStateChanged` devuelve la función para
    // «darse de baja», así que React la ejecuta al desmontar y no quedan oyentes huérfanos (evita fugas de memoria).
    return onAuthStateChanged(auth, (firebaseUser) => {
      // Arrow function `(x) => {...}`: función anónima que Firebase llamará con el usuario (o null si cerró sesión).
      // `dispatch(loadSession(...))`: ejecuta el thunk; Redux Toolkit incluye redux-thunk por defecto.
      dispatch(loadSession(firebaseUser))
    })
    // Arreglo de dependencias: `dispatch` es estable, así que el efecto se ejecuta una sola vez.
  }, [dispatch])

  // `return` de un componente: el JSX que React dibujará.
  return (
    // `<>...</>` (Fragment): agrupa elementos sin añadir un <div> extra al HTML.
    <>
      {/* Accesibilidad (WCAG): enlace para que quien usa teclado salte el menú y vaya directo al contenido. */}
      {/* `className` (no `class`, que es palabra reservada de JS): asigna clases CSS. */}
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      {/* Todas las pantallas viven dentro del enrutador. */}
      <AppRouter />
    </>
  )
}
