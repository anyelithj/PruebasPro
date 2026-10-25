import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { Role } from "@/lib/constants";
// [Slice Auth]: estado cliente del usuario actual (no tokens — viven en cookies httpOnly) | [Patrón]: State + Redux Slice | [Principio]: SRP | [Paradigma]: FP + Inmutabilidad

// [Forma usuario]: subset seguro expuesto al cliente | [Principio]: ISP

export interface AuthUserState {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
}

export interface AuthState {
  // [user]: null si no hay sesión
  user: AuthUserState | null;
  // [status]: máquina de estados simple del slice | [Patrón]: State
  status: "idle" | "authenticating" | "authenticated" | "error";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // [authStart]: marca el inicio de login/register | [Patrón]: Action
    authStart(state) {
      state.status = "authenticating";
      state.error = null;
    },
    // [authSuccess]: guarda user al obtener respuesta backend
    authSuccess(state, action: PayloadAction<AuthUserState>) {
      state.user = action.payload;
      state.status = "authenticated";
      state.error = null;
    },
    // [authFailure]: error message para UI
    authFailure(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },
    // [authLogout]: limpia estado cliente (cookies se limpian server-side)
    authLogout(state) {
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
    // [setUser]: hidratación desde RSC (cuando el layout server sabe quién es)
    setUser(state, action: PayloadAction<AuthUserState | null>) {
      state.user = action.payload;
      state.status = action.payload ? "authenticated" : "idle";
    },
  },
});

export const { authStart, authSuccess, authFailure, authLogout, setUser } =
  authSlice.actions;
export default authSlice.reducer;
