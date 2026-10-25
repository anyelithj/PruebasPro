// [Test TimerBar]: countdown visual + onExpire | [Patrón]: Component Test | [Principio]: Determinista
import { render, screen, act } from "@testing-library/react";
import { TimerBar } from "@/components/quiz/TimerBar";

describe("TimerBar", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renderiza el rol timer y el progressbar", () => {
    render(<TimerBar seconds={30} onExpire={() => {}} />);
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra los segundos iniciales y aria-valuemax", () => {
    render(<TimerBar seconds={30} onExpire={() => {}} />);
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "30");
  });

  it("invoca onExpire cuando el tiempo llega a 0", () => {
    const onExpire = jest.fn();
    render(<TimerBar seconds={1} onExpire={onExpire} />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("no avanza el tiempo cuando isPaused", () => {
    render(<TimerBar seconds={30} onExpire={() => {}} isPaused />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText("30s")).toBeInTheDocument();
  });
});
