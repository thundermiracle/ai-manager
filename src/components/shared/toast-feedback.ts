import type { SnackbarTone } from "./Snackbar";

interface ToastDiagnosticLike {
  code: string;
}

export interface ToastFeedbackLike {
  kind: "success" | "error";
  message: string;
  diagnostic?: ToastDiagnosticLike;
}

export interface ToastNotification {
  tone: SnackbarTone;
  message: string;
}

export function buildToastNotification(
  feedback: ToastFeedbackLike | null,
): ToastNotification | null {
  if (feedback === null) {
    return null;
  }

  if (feedback.kind === "error" && feedback.diagnostic) {
    return {
      tone: "error",
      message: `CODE: ${feedback.diagnostic.code} | ${feedback.message}`,
    };
  }

  return {
    tone: feedback.kind === "error" ? "error" : "success",
    message: feedback.message,
  };
}
