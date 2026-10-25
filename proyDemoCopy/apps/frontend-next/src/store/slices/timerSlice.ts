import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
// [Slice timer]: cronómetro de sesión global (separable de useTimer local) | [Patrón]: State + Redux Slice | [Principio]: SRP | [Paradigma]: FP + Inmutabilidad

export type TimerStatus = "idle" | "running" | "paused" | "expired";

export interface TimerState {
  status: TimerStatus;
  initialSeconds: number;
  secondsLeft: number;
}

const initialState: TimerState = {
  status: "idle",
  initialSeconds: 0,
  secondsLeft: 0,
};

const timerSlice = createSlice({
  name: "timer",
  initialState,
  reducers: {
    // [start]: arranca/reinicia el countdown con N segundos | [Patrón]: Action
    start(state, action: PayloadAction<number>) {
      const seconds = Math.max(0, Math.floor(action.payload));
      state.initialSeconds = seconds;
      state.secondsLeft = seconds;
      state.status = seconds > 0 ? "running" : "expired";
    },
    // [tick]: descuenta 1s (clamp a 0; al llegar marca expired) | [Patrón]: State Machine
    tick(state) {
      if (state.status !== "running") return;
      const next = state.secondsLeft - 1;
      if (next <= 0) {
        state.secondsLeft = 0;
        state.status = "expired";
      } else {
        state.secondsLeft = next;
      }
    },
    // [pause / resume]: pausa temporal
    pause(state) {
      if (state.status === "running") state.status = "paused";
    },
    resume(state) {
      if (state.status === "paused") state.status = "running";
    },
    // [reset]: vuelve al estado inicial limpio
    reset() {
      return initialState;
    },
  },
});

export const { start, tick, pause, resume, reset } = timerSlice.actions;
export default timerSlice.reducer;

// [Selectors]: lectura tipada | [Principio]: DRY
export const selectTimerStatus = (state: { timer: TimerState }): TimerStatus => state.timer.status;
export const selectSecondsLeft = (state: { timer: TimerState }): number => state.timer.secondsLeft;
export const selectTimerPercent = (state: { timer: TimerState }): number => {
  const { initialSeconds, secondsLeft } = state.timer;
  return initialSeconds > 0 ? (secondsLeft / initialSeconds) * 100 : 0;
};
