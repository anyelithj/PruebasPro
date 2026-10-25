// [Test authSlice]: reducer puro + acciones | [Patrón]: Unit Test reducer | [Principio]: FP + Inmutabilidad
import authReducer, {
  authStart,
  authSuccess,
  authFailure,
  authLogout,
  setUser,
  type AuthState,
  type AuthUserState,
} from "@/store/slices/authSlice";
import { Role } from "@/lib/constants";

// [usuario de prueba]: forma segura expuesta al cliente
const user: AuthUserState = {
  id: "u1",
  email: "user@test.com",
  firstName: "Ada",
  lastName: "Lovelace",
  role: Role.USER,
  isEmailVerified: true,
};

const initial: AuthState = { user: null, status: "idle", error: null };

describe("authSlice reducer", () => {
  // [estado inicial]
  it("devuelve el estado inicial con acción desconocida", () => {
    expect(authReducer(undefined, { type: "@@INIT" })).toEqual(initial);
  });

  // [authStart]: pasa a authenticating y limpia error
  it("authStart marca status authenticating y limpia error", () => {
    const state = authReducer({ ...initial, error: "previo" }, authStart());
    expect(state.status).toBe("authenticating");
    expect(state.error).toBeNull();
  });

  // [authSuccess]: guarda user y autentica
  it("authSuccess guarda el usuario y autentica", () => {
    const state = authReducer(initial, authSuccess(user));
    expect(state.user).toEqual(user);
    expect(state.status).toBe("authenticated");
    expect(state.error).toBeNull();
  });

  // [authFailure]: error y status error
  it("authFailure guarda el mensaje de error", () => {
    const state = authReducer(initial, authFailure("Credenciales inválidas"));
    expect(state.status).toBe("error");
    expect(state.error).toBe("Credenciales inválidas");
  });

  // [authLogout]: resetea a idle
  it("authLogout limpia el estado de cliente", () => {
    const loggedIn: AuthState = { user, status: "authenticated", error: null };
    const state = authReducer(loggedIn, authLogout());
    expect(state).toEqual(initial);
  });

  // [setUser]: hidratación desde RSC
  it("setUser con usuario autentica; con null vuelve a idle", () => {
    expect(authReducer(initial, setUser(user)).status).toBe("authenticated");
    const cleared = authReducer(
      { user, status: "authenticated", error: null },
      setUser(null),
    );
    expect(cleared.user).toBeNull();
    expect(cleared.status).toBe("idle");
  });

  // [inmutabilidad]: no muta el estado previo
  it("no muta el estado previo (inmutabilidad)", () => {
    const prev = { ...initial };
    authReducer(prev, authSuccess(user));
    expect(prev).toEqual(initial);
  });
});
