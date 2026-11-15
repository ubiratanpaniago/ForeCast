import { useCallback, useEffect, useState } from "react";

export function useTemporalPlayback(
  years: number[],
  year: number,
  onYearChange: (year: number) => void,
) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const selectYear = useCallback(
    (value: number) => {
      setPlaying(false);
      onYearChange(value);
    },
    [onYearChange],
  );
  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (years.length < 2) return;
    if (year === years[years.length - 1]) onYearChange(years[0]);
    setPlaying(true);
  };
  useEffect(() => {
    if (!playing || years.length < 2) return;
    const timer = window.setTimeout(() => {
      const index = years.indexOf(year);
      if (index < years.length - 1) onYearChange(years[index + 1]);
      else if (loop) onYearChange(years[0]);
      else setPlaying(false);
    }, 1000 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, speed, loop, year, years, onYearChange]);
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  return { playing, speed, setSpeed, loop, setLoop, toggle, selectYear };
}
