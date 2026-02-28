import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

type SnackbarTone = "success" | "error" | "warning" | "info";

interface SnackbarProps {
  open: boolean;
  tone?: SnackbarTone;
  message: string;
  durationMs?: number;
  onClose: () => void;
}

const TONE_STYLES: Record<SnackbarTone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  error: "border-rose-300 bg-rose-50 text-rose-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
};

const RING_TRACK_STYLES: Record<SnackbarTone, string> = {
  success: "stroke-emerald-900/20",
  error: "stroke-rose-900/20",
  warning: "stroke-amber-900/20",
  info: "stroke-sky-900/20",
};

const RING_PROGRESS_STYLES: Record<SnackbarTone, string> = {
  success: "stroke-emerald-600",
  error: "stroke-rose-600",
  warning: "stroke-amber-600",
  info: "stroke-sky-600",
};

const SNACKBAR_EXIT_MS = 220;
const COUNTDOWN_RADIUS = 10;
const COUNTDOWN_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RADIUS;

export function Snackbar({
  open,
  tone = "info",
  message,
  durationMs = 5000,
  onClose,
}: SnackbarProps) {
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [countdownProgress, setCountdownProgress] = useState(1);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      const frameId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => {
      setIsRendered(false);
    }, SNACKBAR_EXIT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCountdownProgress(1);
      return;
    }

    const safeDurationMs = Math.max(durationMs, 1);
    const startedAt = window.performance.now();

    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      const remainingMs = Math.max(safeDurationMs - elapsedMs, 0);
      setCountdownProgress(remainingMs / safeDurationMs);

      if (remainingMs > 0) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    let frameId = window.requestAnimationFrame(tick);
    const timeoutId = window.setTimeout(() => {
      onCloseRef.current();
    }, safeDurationMs);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, open]);

  if (!isRendered) {
    return null;
  }

  const countdownOffset = COUNTDOWN_CIRCUMFERENCE * (1 - countdownProgress);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-[min(26rem,calc(100vw-2rem))]">
      <div
        role={tone === "error" ? "alert" : "status"}
        className={cn(
          "grid gap-3 rounded-xl border p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition duration-200 ease-out",
          isVisible
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-[0.98] opacity-0",
          TONE_STYLES[tone],
        )}
      >
        <p className="text-sm leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <svg viewBox="0 0 24 24" className="-rotate-90" width="22" height="22" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r={COUNTDOWN_RADIUS}
              className={cn("fill-none stroke-[2.25]", RING_TRACK_STYLES[tone])}
            />
            <circle
              cx="12"
              cy="12"
              r={COUNTDOWN_RADIUS}
              className={cn("fill-none stroke-[2.25]", RING_PROGRESS_STYLES[tone])}
              strokeDasharray={COUNTDOWN_CIRCUMFERENCE}
              strokeDashoffset={countdownOffset}
              strokeLinecap="round"
            />
          </svg>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
