// [Test timerSlice]: reducer + acciones start/tick/pause/resume/reset
import reducer, {
  start,
  tick,
  pause,
  resume,
  reset,
  selectTimerPercent,
  selectTimerStatus,
  selectSecondsLeft,
  type TimerState,
} from "@/store/slices/timerSlice";

const initial: TimerState = { status: "idle", initialSeconds: 0, secondsLeft: 0 };

describe("timerSlice", () => {
  it("expone un reducer por defecto y estado inicial", () => {
    expect(typeof reducer).toBe("function");
    expect(reducer(undefined, { type: "@@INIT" })).toEqual(initial);
  });

  it("start(seconds) arranca el countdown", () => {
    const next = reducer(initial, start(30));
    expect(next).toEqual({ status: "running", initialSeconds: 30, secondsLeft: 30 });
  });

  it("start(0) deja el estado en `expired` (no corre con 0s)", () => {
    const next = reducer(initial, start(0));
    expect(next.status).toBe("expired");
    expect(next.secondsLeft).toBe(0);
  });

  it("tick descuenta 1s mientras `running`", () => {
    const running = reducer(initial, start(3));
    const after = reducer(running, tick());
    expect(after.secondsLeft).toBe(2);
    expect(after.status).toBe("running");
  });

  it("tick al llegar a 0 marca `expired`", () => {
    let state = reducer(initial, start(1));
    state = reducer(state, tick());
    expect(state.status).toBe("expired");
    expect(state.secondsLeft).toBe(0);
  });

  it("tick no afecta si está `paused`", () => {
    let state = reducer(initial, start(5));
    state = reducer(state, pause());
    expect(state.status).toBe("paused");
    state = reducer(state, tick());
    expect(state.secondsLeft).toBe(5);
  });

  it("resume vuelve a `running` desde `paused`", () => {
    let state = reducer(initial, start(5));
    state = reducer(state, pause());
    state = reducer(state, resume());
    expect(state.status).toBe("running");
  });

  it("reset vuelve al estado inicial", () => {
    let state = reducer(initial, start(10));
    state = reducer(state, tick());
    state = reducer(state, reset());
    expect(state).toEqual(initial);
  });

  describe("selectors", () => {
    const root = { timer: { status: "running" as const, initialSeconds: 40, secondsLeft: 10 } };
    it("selectTimerStatus", () => {
      expect(selectTimerStatus(root)).toBe("running");
    });
    it("selectSecondsLeft", () => {
      expect(selectSecondsLeft(root)).toBe(10);
    });
    it("selectTimerPercent", () => {
      expect(selectTimerPercent(root)).toBe(25);
      expect(selectTimerPercent({ timer: initial })).toBe(0);
    });
  });
});
