import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import { Snackbar, type SnackbarTone } from "./Snackbar";

interface ToastState {
  tone: SnackbarTone;
  message: string;
  durationMs: number;
}

interface ShowToastInput {
  tone?: SnackbarTone;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (input: ShowToastInput) => void;
  clearToast: () => void;
}

const DEFAULT_TOAST_DURATION_MS = 5000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((input: ShowToastInput) => {
    setToast({
      tone: input.tone ?? "info",
      message: input.message,
      durationMs: input.durationMs ?? DEFAULT_TOAST_DURATION_MS,
    });
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      clearToast,
    }),
    [clearToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={toast !== null}
        tone={toast?.tone ?? "info"}
        message={toast?.message ?? ""}
        durationMs={toast?.durationMs ?? DEFAULT_TOAST_DURATION_MS}
        onClose={clearToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return value;
}
