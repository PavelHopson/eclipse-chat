import { useEffect, useMemo, useState } from "react";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function SpiderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    return {
      label: `${pad(hours)}:${pad(minutes)}`,
      seconds: pad(seconds),
      hourDeg: ((hours % 12) + minutes / 60) * 30,
      minuteDeg: (minutes + seconds / 60) * 6,
      secondDeg: seconds * 6,
      title: now.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  }, [now]);

  return (
    <div
      className="ec-spider-clock"
      title={`Системное время: ${state.title}`}
      aria-label={`Системное время ${state.title}`}
    >
      <span className="ec-spider-clock__dial" aria-hidden>
        <span className="ec-spider-clock__web ec-spider-clock__web--a" />
        <span className="ec-spider-clock__web ec-spider-clock__web--b" />
        <span
          className="ec-spider-clock__hand ec-spider-clock__hand--hour"
          style={{ transform: `rotate(${state.hourDeg}deg)` }}
        />
        <span
          className="ec-spider-clock__hand ec-spider-clock__hand--minute"
          style={{ transform: `rotate(${state.minuteDeg}deg)` }}
        />
        <span
          className="ec-spider-clock__hand ec-spider-clock__hand--second"
          style={{ transform: `rotate(${state.secondDeg}deg)` }}
        />
        <span className="ec-spider-clock__node" />
      </span>
      <span className="ec-spider-clock__time">{state.label}</span>
      <span className="ec-spider-clock__sec">{state.seconds}</span>
    </div>
  );
}
